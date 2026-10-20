import argparse
import csv
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from itertools import combinations
from pathlib import Path
import os
import shutil

import numpy as np
from PIL import Image
import tensorflow as tf
from labels import COTTON_DISPLAY_LABELS

IMAGE_SIZE = (224, 224)
BATCH_SIZE = 32
SEED = 47
SUPPORTED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PLANTVILLAGE = Path(__file__).parent / "dataset" / "PlantVillage" / "PlantVillage"
DEFAULT_COTTON = PROJECT_ROOT / "Dataset" / "cotton"
COTTON_CLASSES = (
    "bacterial_blight",
    "curl_virus",
    "fussarium_wilt",
    "healthy",
)
ARTIFACT_NAMES = ("crop_mobilenet.keras", "class_names.json", "metadata.json")


def _image_paths(class_directory):
    return sorted(
        path
        for path in class_directory.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_IMAGE_EXTENSIONS
    )


def collect_records(plantvillage_dir, cotton_dir, old_class_names):
    if not plantvillage_dir.is_dir():
        raise FileNotFoundError(f"PlantVillage directory not found: {plantvillage_dir}")
    if not cotton_dir.is_dir():
        raise FileNotFoundError(f"Cotton directory not found: {cotton_dir}")

    plantvillage_classes = {path.name: path for path in plantvillage_dir.iterdir() if path.is_dir()}
    cotton_classes = {path.name: path for path in cotton_dir.iterdir() if path.is_dir()}
    if set(plantvillage_classes) != set(old_class_names):
        missing = sorted(set(old_class_names) - set(plantvillage_classes))
        extra = sorted(set(plantvillage_classes) - set(old_class_names))
        raise ValueError(f"PlantVillage source does not match the active class map; missing={missing}, extra={extra}")
    if set(cotton_classes) != set(COTTON_CLASSES):
        missing = sorted(set(COTTON_CLASSES) - set(cotton_classes))
        extra = sorted(set(cotton_classes) - set(COTTON_CLASSES))
        raise ValueError(f"Cotton source does not match the four expected class folders; missing={missing}, extra={extra}")

    records = []
    source_counts = {}
    for label in [*old_class_names, *COTTON_CLASSES]:
        directory = plantvillage_classes.get(label) or cotton_classes.get(label)
        paths = _image_paths(directory)
        if len(paths) < 3:
            raise ValueError(f"Class {label!r} needs at least three supported images; found {len(paths)}.")
        source_counts[label] = len(paths)
        records.extend((path, label) for path in paths)
    return records, source_counts


def _perceptual_hash(path, dct_matrix):
    with Image.open(path) as source:
        pixels = np.asarray(
            source.convert("L").resize((32, 32), Image.Resampling.LANCZOS),
            dtype=np.float32,
        )
    low_frequencies = dct_matrix.T @ pixels @ dct_matrix
    threshold = float(np.median(low_frequencies.reshape(-1)[1:]))
    value = 0
    for bit in (low_frequencies > threshold).reshape(-1):
        value = (value << 1) | int(bit)
    return value


def group_near_duplicates(records):
    coordinate = np.arange(32, dtype=np.float32)
    frequency = np.arange(8, dtype=np.float32)
    dct_matrix = np.cos(
        np.pi / 32 * (coordinate[:, None] + 0.5) * frequency[None, :]
    ).astype(np.float32)
    dct_matrix *= np.sqrt(2.0 / 32)
    dct_matrix[:, 0] /= np.sqrt(2.0)

    hashes = [_perceptual_hash(path, dct_matrix) for path, _ in records]
    parents = list(range(len(records)))

    def find(index):
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index

    def union(left, right):
        left_root = find(left)
        right_root = find(right)
        if left_root != right_root:
            parents[right_root] = left_root

    bands = ((0, 13), (13, 26), (26, 39), (39, 52), (52, 64))
    buckets = defaultdict(list)
    for index, value in enumerate(hashes):
        for band_index, (start, end) in enumerate(bands):
            width = end - start
            bucket = (band_index, (value >> (64 - end)) & ((1 << width) - 1))
            buckets[bucket].append(index)

    checked_pairs = set()
    near_pair_count = 0
    for bucket_indices in buckets.values():
        for left, right in combinations(bucket_indices, 2):
            pair = (left, right) if left < right else (right, left)
            if pair in checked_pairs:
                continue
            checked_pairs.add(pair)
            if (hashes[left] ^ hashes[right]).bit_count() <= 4:
                near_pair_count += 1
                union(left, right)

    grouped = defaultdict(list)
    for index, record in enumerate(records):
        grouped[find(index)].append(record)

    pure_groups = []
    ambiguous_groups = []
    duplicate_component_count = 0
    duplicate_image_count = 0
    for group in grouped.values():
        if len(group) > 1:
            duplicate_component_count += 1
            duplicate_image_count += len(group)
        if len({label for _, label in group}) > 1:
            ambiguous_groups.append(group)
        else:
            pure_groups.append(group)

    report = {
        "algorithm": "64-bit DCT perceptual hash; Hamming distance <= 4",
        "near_duplicate_pairs": near_pair_count,
        "duplicate_components": duplicate_component_count,
        "images_in_duplicate_components": duplicate_image_count,
        "cross_class_components_excluded": len(ambiguous_groups),
        "cross_class_images_excluded": sum(len(group) for group in ambiguous_groups),
    }
    return pure_groups, report


def split_groups(groups, class_names, validation_fraction, test_fraction, seed):
    groups_by_class = defaultdict(list)
    for group in groups:
        groups_by_class[group[0][1]].append(group)

    rng = np.random.default_rng(seed)
    split_records = {"train": [], "validation": [], "test": []}
    for class_name in class_names:
        class_groups = groups_by_class[class_name]
        rng.shuffle(class_groups)
        image_count = sum(len(group) for group in class_groups)
        if len(class_groups) < 3:
            raise ValueError(f"Class {class_name!r} has fewer than three duplicate groups after filtering.")

        remaining = list(class_groups)

        def take_until(target_count, reserve_groups):
            selected = []
            selected_count = 0
            while selected_count < target_count and len(remaining) > reserve_groups:
                group = remaining.pop()
                selected.append(group)
                selected_count += len(group)
            return selected

        test_groups = take_until(max(1, round(image_count * test_fraction)), 2)
        validation_groups = take_until(max(1, round(image_count * validation_fraction)), 1)
        for group in remaining:
            split_records["train"].extend(group)
        for group in validation_groups:
            split_records["validation"].extend(group)
        for group in test_groups:
            split_records["test"].extend(group)

    for split_name, split in split_records.items():
        present = {label for _, label in split}
        missing = sorted(set(class_names) - present)
        if missing:
            raise ValueError(f"The {split_name} split is missing classes: {missing}")
    return split_records


def make_dataset(records, class_to_index, batch_size, training=False, sample_weights=None, seed=SEED):
    paths = np.asarray([str(path) for path, _ in records], dtype=str)
    labels = np.asarray([class_to_index[label] for _, label in records], dtype=np.int32)
    dataset = tf.data.Dataset.from_tensor_slices((paths, labels))
    if training:
        dataset = dataset.shuffle(len(records), seed=seed, reshuffle_each_iteration=True)

    def load_rgb(path_value):
        path_text = path_value.decode("utf-8") if isinstance(path_value, bytes) else str(path_value)
        with Image.open(path_text) as source:
            image = source.convert("RGB").resize(IMAGE_SIZE, Image.Resampling.BILINEAR)
            return np.asarray(image, dtype=np.float32)

    def decode(path, label):
        image = tf.numpy_function(load_rgb, [path], tf.float32)
        image.set_shape((*IMAGE_SIZE, 3))
        if sample_weights is not None:
            return image, label, tf.gather(sample_weights, label)
        return image, label

    return dataset.map(decode, num_parallel_calls=tf.data.AUTOTUNE).batch(batch_size).prefetch(tf.data.AUTOTUNE)


def extend_model(old_model_path, old_class_names, class_names, unfreeze_layers):
    old_model = tf.keras.models.load_model(old_model_path, compile=False)
    if tuple(old_model.input_shape[1:]) != (*IMAGE_SIZE, 3):
        raise ValueError(f"Existing model input is {old_model.input_shape}, expected 224x224 RGB.")
    if old_model.output_shape[-1] != len(old_class_names):
        raise ValueError("Existing model output count does not match its class-name mapping.")

    old_classifier = old_model.layers[-1]
    if not isinstance(old_classifier, tf.keras.layers.Dense):
        raise ValueError("The existing model does not end in the expected Dense classifier.")
    backbone = next(
        (layer for layer in old_model.layers if isinstance(layer, tf.keras.Model) and len(layer.layers) > 100),
        None,
    )
    if backbone is None:
        raise ValueError("Could not identify the nested MobileNetV2 feature extractor.")
    if len(backbone.layers) <= unfreeze_layers:
        raise ValueError("Requested fine-tune depth is not smaller than the backbone depth.")

    new_classifier = tf.keras.layers.Dense(len(class_names), activation="softmax", name="class_predictions")
    outputs = new_classifier(old_classifier.input)
    model = tf.keras.Model(old_model.input, outputs, name="leafline_mobilenetv2_19class")
    old_kernel, old_bias = old_classifier.get_weights()
    new_kernel, new_bias = new_classifier.get_weights()
    new_kernel[:, : len(old_class_names)] = old_kernel
    new_bias[: len(old_class_names)] = old_bias
    new_classifier.set_weights((new_kernel, new_bias))
    backbone.trainable = False
    return model, backbone


def compile_model(model, learning_rate):
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )


def validation_loss(model, validation_ds):
    compile_model(model, 1e-5)
    return float(model.evaluate(validation_ds, verbose=0)[0])


def fit_stage(model, train_ds, validation_ds, checkpoint_path, epochs, learning_rate):
    if epochs <= 0:
        return
    compile_model(model, learning_rate)
    callbacks = [
        tf.keras.callbacks.ModelCheckpoint(
            filepath=checkpoint_path,
            monitor="val_loss",
            save_best_only=True,
            verbose=1,
        ),
        tf.keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=3,
            restore_best_weights=True,
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.3,
            patience=2,
            min_lr=1e-7,
        ),
    ]
    model.fit(
        train_ds,
        validation_data=validation_ds,
        epochs=epochs,
        callbacks=callbacks,
        verbose=2,
    )


def evaluate_predictions(class_names, truth, scores):
    predictions = np.argmax(scores, axis=1)
    matrix = np.zeros((len(class_names), len(class_names)), dtype=np.int64)
    np.add.at(matrix, (truth, predictions), 1)
    support = matrix.sum(axis=1)
    predicted_count = matrix.sum(axis=0)
    true_positive = np.diag(matrix)
    precision = np.divide(true_positive, predicted_count, out=np.zeros_like(true_positive, dtype=float), where=predicted_count != 0)
    recall = np.divide(true_positive, support, out=np.zeros_like(true_positive, dtype=float), where=support != 0)
    f1 = np.divide(2 * precision * recall, precision + recall, out=np.zeros_like(precision), where=(precision + recall) != 0)
    total = int(support.sum())
    summary = {
        "accuracy": float(true_positive.sum() / total),
        "precision_macro": float(precision.mean()),
        "recall_macro": float(recall.mean()),
        "f1_macro": float(f1.mean()),
        "precision_weighted": float(np.average(precision, weights=support)),
        "recall_weighted": float(np.average(recall, weights=support)),
        "f1_weighted": float(np.average(f1, weights=support)),
        "test_images": total,
        "per_class": {
            class_name: {
                "precision": float(precision[index]),
                "recall": float(recall[index]),
                "f1": float(f1[index]),
                "support": int(support[index]),
            }
            for index, class_name in enumerate(class_names)
        },
        "confusion_matrix": matrix.tolist(),
    }
    if not all(np.isfinite(value) for key, value in summary.items() if key.endswith(("accuracy", "macro", "weighted"))):
        raise ValueError("Evaluation produced non-finite metrics.")
    if np.any(support == 0):
        raise ValueError("At least one class has no held-out test images.")
    return summary


def write_confusion_matrix(path, class_names, matrix):
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["actual \\ predicted", *class_names])
        for class_name, row in zip(class_names, matrix, strict=True):
            writer.writerow([class_name, *row])


def verify_candidate(model_path, class_names_path, expected_classes, sample_batch):
    with class_names_path.open("r", encoding="utf-8") as file:
        saved_names = json.load(file)
    if saved_names != expected_classes:
        raise ValueError("Candidate class mapping changed during save.")
    model = tf.keras.models.load_model(model_path, compile=False)
    if tuple(model.input_shape[1:]) != (*IMAGE_SIZE, 3) or model.output_shape[-1] != len(expected_classes):
        raise ValueError("Candidate input/output shapes do not match the 19-class contract.")
    probabilities = model.predict(sample_batch, verbose=0)
    if probabilities.shape != (len(sample_batch), len(expected_classes)):
        raise ValueError("Candidate prediction returned the wrong shape.")
    if not np.isfinite(probabilities).all() or not np.allclose(probabilities.sum(axis=1), 1.0, atol=1e-4):
        raise ValueError("Candidate prediction returned invalid class probabilities.")
    return model


def activate_candidate(candidate_dir, output_dir, model_version):
    backup_dir = output_dir / "backups" / f"pre-cotton-{model_version}"
    backup_dir.mkdir(parents=True, exist_ok=False)
    for name in ARTIFACT_NAMES:
        active_path = output_dir / name
        if not active_path.is_file():
            raise FileNotFoundError(f"Cannot safely activate without the current artifact: {active_path}")
        shutil.copy2(active_path, backup_dir / name)

    replaced = []
    temporary_paths = []
    try:
        for name in ARTIFACT_NAMES:
            active_path = output_dir / name
            temporary_path = output_dir / f".{name}.{model_version}.tmp"
            shutil.copy2(candidate_dir / name, temporary_path)
            temporary_paths.append(temporary_path)
            os.replace(temporary_path, active_path)
            replaced.append(name)
    except Exception:
        for name in replaced:
            shutil.copy2(backup_dir / name, output_dir / name)
        raise
    finally:
        for path in temporary_paths:
            path.unlink(missing_ok=True)
    return backup_dir


def train(
    plantvillage_dir,
    cotton_dir,
    output_dir,
    head_epochs=6,
    fine_tune_epochs=5,
    batch_size=BATCH_SIZE,
    validation_fraction=0.1,
    test_fraction=0.1,
    seed=SEED,
    unfreeze_layers=30,
    resume_checkpoint=None,
    activate=True,
):
    if head_epochs < 1 or fine_tune_epochs < 0:
        raise ValueError("Head epochs must be at least one and fine-tuning epochs cannot be negative.")
    if validation_fraction <= 0 or test_fraction <= 0 or validation_fraction + test_fraction >= 1:
        raise ValueError("Validation and test fractions must be positive and sum to less than one.")
    if batch_size < 1:
        raise ValueError("Batch size must be positive.")

    output_dir.mkdir(parents=True, exist_ok=True)
    with (output_dir / "class_names.json").open("r", encoding="utf-8") as file:
        old_class_names = json.load(file)
    class_names = [*old_class_names, *COTTON_CLASSES]
    if len(set(class_names)) != 19:
        raise ValueError(f"Expected 19 unique classes; found {len(set(class_names))}.")

    tf.keras.utils.set_random_seed(seed)
    records, source_counts = collect_records(plantvillage_dir, cotton_dir, old_class_names)
    print(f"Loaded {len(records)} supported images from the two requested dataset roots.", flush=True)
    groups, duplicate_report = group_near_duplicates(records)
    print(f"Near-duplicate analysis: {json.dumps(duplicate_report, sort_keys=True)}", flush=True)
    split_records = split_groups(groups, class_names, validation_fraction, test_fraction, seed)
    split_counts = {
        split_name: dict(Counter(label for _, label in records_for_split))
        for split_name, records_for_split in split_records.items()
    }

    class_to_index = {name: index for index, name in enumerate(class_names)}
    train_labels = np.asarray([class_to_index[label] for _, label in split_records["train"]], dtype=np.int32)
    counts = np.bincount(train_labels, minlength=len(class_names)).astype(np.float32)
    class_weights = len(train_labels) / (len(class_names) * counts)
    class_weights = np.minimum(class_weights, 5.0)
    class_weights /= np.average(class_weights, weights=counts)
    weights_tensor = tf.constant(class_weights, dtype=tf.float32)
    train_ds = make_dataset(split_records["train"], class_to_index, batch_size, True, weights_tensor, seed)
    validation_ds = make_dataset(split_records["validation"], class_to_index, batch_size)
    test_records = split_records["test"]
    test_paths = np.asarray([str(path) for path, _ in test_records], dtype=str)
    test_truth = np.asarray([class_to_index[label] for _, label in test_records], dtype=np.int32)
    test_images = tf.data.Dataset.from_tensor_slices(test_paths)

    def load_test_image(path):
        def load_rgb(path_value):
            path_text = path_value.decode("utf-8") if isinstance(path_value, bytes) else str(path_value)
            with Image.open(path_text) as source:
                image = source.convert("RGB").resize(IMAGE_SIZE, Image.Resampling.BILINEAR)
                return np.asarray(image, dtype=np.float32)

        image = tf.numpy_function(load_rgb, [path], tf.float32)
        image.set_shape((*IMAGE_SIZE, 3))
        return image

    test_images = test_images.map(load_test_image, num_parallel_calls=tf.data.AUTOTUNE).batch(batch_size).prefetch(tf.data.AUTOTUNE)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    model_version = f"mobilenetv2-cotton-{stamp}"
    candidate_dir = output_dir / "candidates" / model_version
    candidate_dir.mkdir(parents=True, exist_ok=False)
    head_checkpoint = candidate_dir / "best-head.keras"
    fine_checkpoint = candidate_dir / "best-finetune.keras"

    resume_validation_loss = None

    if resume_checkpoint is not None:
        resume_checkpoint = Path(resume_checkpoint).resolve()
        if not resume_checkpoint.is_file():
            raise FileNotFoundError(
                f"Resume checkpoint not found: {resume_checkpoint}"
            )

        resume_class_names_path = resume_checkpoint.parent / "class_names.json"
        if not resume_class_names_path.is_file():
            raise FileNotFoundError(
                f"Resume checkpoint has no class map: {resume_class_names_path}"
            )

        with resume_class_names_path.open("r", encoding="utf-8") as file:
            resume_class_names = json.load(file)

        if resume_class_names != class_names:
            raise ValueError(
                "Resume checkpoint class map does not match the current 19-class order."
            )

        model = tf.keras.models.load_model(resume_checkpoint, compile=False)

        if (
            tuple(model.input_shape[1:]) != (*IMAGE_SIZE, 3)
            or model.output_shape[-1] != len(class_names)
        ):
            raise ValueError(
                "Resume checkpoint input/output shapes do not match the 19-class contract."
            )

        backbone = model.get_layer("mobilenetv2_1.00_224")
        resume_validation_loss = validation_loss(model, validation_ds)

        print(
            f"Resuming from {resume_checkpoint} "
            f"(validation loss {resume_validation_loss:.5f}).",
            flush=True,
        )
        print(
            "Skipping classifier-head training; continuing from the saved checkpoint.",
            flush=True,
        )

        head_model = model
        head_validation_loss = resume_validation_loss

    else:
        model, backbone = extend_model(
            output_dir / "crop_mobilenet.keras",
            old_class_names,
            class_names,
            unfreeze_layers,
        )

        print(
            f"Training 19-class head: {len(split_records['train'])} train, "
            f"{len(split_records['validation'])} validation, "
            f"{len(test_records)} test images.",
            flush=True,
        )

        fit_stage(
            model, train_ds, validation_ds,
            str(head_checkpoint), head_epochs, 1e-3
        )

        if not head_checkpoint.is_file():
            raise RuntimeError(
                "Classifier-head training did not produce a validated checkpoint."
            )

        head_model = tf.keras.models.load_model(
            head_checkpoint, compile=False
        )
        head_validation_loss = validation_loss(head_model, validation_ds)

    selected_model = head_model
    selected_validation_loss = head_validation_loss

    if fine_tune_epochs:
        model = head_model
        backbone = model.get_layer("mobilenetv2_1.00_224")
        backbone.trainable = True
        for layer in backbone.layers[:-unfreeze_layers]:
            layer.trainable = False
        for layer in backbone.layers[-unfreeze_layers:]:
            layer.trainable = not isinstance(layer, tf.keras.layers.BatchNormalization)
        fit_stage(model, train_ds, validation_ds, str(fine_checkpoint), fine_tune_epochs, 1e-5)
        if fine_checkpoint.is_file():
            fine_model = tf.keras.models.load_model(fine_checkpoint, compile=False)
            fine_validation_loss = validation_loss(fine_model, validation_ds)
            if np.isfinite(fine_validation_loss) and fine_validation_loss < selected_validation_loss:
                selected_model = fine_model
                selected_validation_loss = fine_validation_loss

    candidate_model_path = candidate_dir / "crop_mobilenet.keras"
    selected_model.save(candidate_model_path)
    class_names_path = candidate_dir / "class_names.json"
    class_names_path.write_text(json.dumps(class_names, indent=2), encoding="utf-8")
    sample_batch = next(iter(test_images.take(1)))
    verified_model = verify_candidate(candidate_model_path, class_names_path, class_names, sample_batch)
    scores = verified_model.predict(test_images, verbose=1)
    evaluation = evaluate_predictions(class_names, test_truth, scores)
    (candidate_dir / "evaluation.json").write_text(json.dumps(evaluation, indent=2), encoding="utf-8")
    write_confusion_matrix(candidate_dir / "confusion_matrix.csv", class_names, evaluation["confusion_matrix"])

    metadata = {
        "model_version": model_version,
        "architecture": "MobileNetV2",
        "image_size": list(IMAGE_SIZE),
        "class_count": len(class_names),
        "dataset_sources": {
            "plantvillage": str(plantvillage_dir),
            "cotton": str(cotton_dir),
        },
        "source_image_counts": source_counts,
        "split_image_counts": split_counts,
        "near_duplicate_analysis": duplicate_report,
        "split_fractions": {"validation": validation_fraction, "test": test_fraction},
        "fine_tuned_backbone_layers": min(unfreeze_layers, len(backbone.layers)),
        "resumed_from_checkpoint": str(resume_checkpoint) if resume_checkpoint else None,
        "evaluation": {key: value for key, value in evaluation.items() if key != "confusion_matrix" and key != "per_class"},
        "display_names": COTTON_DISPLAY_LABELS,
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
    }
    (candidate_dir / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    print("Held-out metrics:")
    print(json.dumps({key: value for key, value in evaluation.items() if key not in {"confusion_matrix", "per_class"}}, indent=2))
    print("Per-class test metrics:")
    for class_name, metrics in evaluation["per_class"].items():
        print(f"{class_name}: precision={metrics['precision']:.4f} recall={metrics['recall']:.4f} f1={metrics['f1']:.4f} support={metrics['support']}")
    print(f"Confusion matrix saved to {candidate_dir / 'confusion_matrix.csv'}")
    print(f"Candidate and complete report saved to {candidate_dir}")

    if activate:
        backup_dir = activate_candidate(candidate_dir, output_dir, model_version)
        print(f"Activated verified 19-class model. Previous artifacts backed up to {backup_dir}.")
        print("Restart the Flask AI service to load the activated model.")
    else:
        print("Activation disabled; the current working model remains unchanged.")
    return candidate_dir, evaluation


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extend the existing MobileNetV2 model with grouped PlantVillage and Cotton data.")
    parser.add_argument("--plantvillage-dataset", "--dataset", dest="plantvillage_dataset", type=Path, default=DEFAULT_PLANTVILLAGE)
    parser.add_argument("--cotton-dataset", type=Path, default=DEFAULT_COTTON)
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "models")
    parser.add_argument("--head-epochs", "--epochs", dest="head_epochs", type=int, default=6)
    parser.add_argument("--fine-tune-epochs", type=int, default=5)
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE)
    parser.add_argument("--validation-fraction", type=float, default=0.1)
    parser.add_argument("--test-fraction", type=float, default=0.1)
    parser.add_argument("--unfreeze-layers", type=int, default=30)
    parser.add_argument("--seed", type=int, default=SEED)
    parser.add_argument("--resume-checkpoint", type=Path)
    parser.add_argument("--no-activate", action="store_true", help="Train and evaluate a candidate but leave active artifacts untouched.")
    args = parser.parse_args()
    train(
        args.plantvillage_dataset.resolve(),
        args.cotton_dataset.resolve(),
        args.output.resolve(),
        head_epochs=args.head_epochs,
        fine_tune_epochs=args.fine_tune_epochs,
        batch_size=args.batch_size,
        validation_fraction=args.validation_fraction,
        test_fraction=args.test_fraction,
        seed=args.seed,
        unfreeze_layers=args.unfreeze_layers,
        resume_checkpoint=args.resume_checkpoint,
        activate=not args.no_activate,
    )