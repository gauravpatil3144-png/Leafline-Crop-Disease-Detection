import json
import logging
import os
import threading
from pathlib import Path

from labels import crop_label as get_crop_label
from labels import display_class_label

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / os.getenv("MODEL_PATH", "models/crop_mobilenet.keras")
CLASS_NAMES_PATH = BASE_DIR / os.getenv("CLASS_NAMES_PATH", "models/class_names.json")
MODEL_METADATA_PATH = BASE_DIR / os.getenv("MODEL_METADATA_PATH", "models/metadata.json")
logger = logging.getLogger(__name__)

_model = None
_class_names = None
_model_version = None
_load_lock = threading.Lock()


class ModelNotReadyError(Exception):
    pass


class InvalidImageError(Exception):
    pass


def model_status():
    missing = [str(path.relative_to(BASE_DIR)) for path in (MODEL_PATH, CLASS_NAMES_PATH) if not path.is_file()]
    if missing:
        return {"ready": False, "missing": missing}
    return {"ready": True, "missing": []}


def _load_model():
    global _model, _class_names, _model_version

    if _model is not None:
        return _model, _class_names, _model_version

    with _load_lock:
        if _model is not None:
            return _model, _class_names, _model_version

        status = model_status()
        if not status["ready"]:
            raise ModelNotReadyError(
                "A trained model and class-name file are not available yet."
            )

        try:
            import tensorflow as tf

            with CLASS_NAMES_PATH.open("r", encoding="utf-8") as file:
                class_names = json.load(file)

            if (
                not isinstance(class_names, list)
                or not class_names
                or not all(isinstance(name, str) for name in class_names)
            ):
                raise ValueError(
                    "class_names.json must contain a non-empty array of class labels."
                )

            model = tf.keras.models.load_model(MODEL_PATH, compile=False)

            if model.output_shape[-1] != len(class_names):
                raise ValueError(
                    "Model output count does not match class_names.json."
                )

            metadata = {}
            if MODEL_METADATA_PATH.is_file():
                with MODEL_METADATA_PATH.open("r", encoding="utf-8") as file:
                    metadata = json.load(file)

            _model = model
            _class_names = class_names
            _model_version = metadata.get(
                "model_version", "trained-mobilenetv2"
            )

            return _model, _class_names, _model_version

        except ModuleNotFoundError as error:
            logger.exception(
                "Model loading failed because module %s is unavailable: %s",
                error.name,
                error,
            )
            raise ModelNotReadyError(
                f"Missing Python module: {error.name}. Details: {error}"
            ) from error

        except Exception as error:
            logger.exception(
                "Model loading failed (%s): %s", type(error).__name__, error
            )
            raise ModelNotReadyError(
                f"Model loading failed: {type(error).__name__}: {error}"
            ) from error




def _prepare_image(image_bytes):
    from io import BytesIO

    import numpy as np
    from PIL import Image, UnidentifiedImageError

    try:
        image = Image.open(BytesIO(image_bytes))
        if image.format not in {"JPEG", "PNG", "WEBP"}:
            raise InvalidImageError("Only JPEG, PNG, and WebP images are supported.")
        if image.width * image.height > 25_000_000:
            raise InvalidImageError("Image dimensions are too large to process.")
        original_dimensions = image.size
        image = image.convert("RGB")
        image.load()
        image = image.resize((224, 224), Image.Resampling.BILINEAR)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        raise InvalidImageError("The uploaded file is not a valid, readable image.") from error

    array = np.asarray(image, dtype=np.float32)
    return np.expand_dims(array, axis=0), original_dimensions


def _display_class(raw_label):
    return display_class_label(raw_label)


def predict_image(image_bytes, top_k=3, request_id=None):
    if not image_bytes:
        raise InvalidImageError("The uploaded image is empty.")
    batch, original_dimensions = _prepare_image(image_bytes)
    model, class_names, model_version = _load_model()
    scores = model.predict(batch, verbose=0)[0]
    ranked = sorted(enumerate(scores.tolist()), key=lambda item: item[1], reverse=True)[: min(top_k, len(class_names))]
    predictions = [{"label": _display_class(class_names[index]), "confidence": float(score)} for index, score in ranked]
    crop_name = get_crop_label(class_names[ranked[0][0]])
    logger.info(
        "prediction request_id=%s image_dimensions=%sx%s model_path=%s output_shape=%s top_class=%s top_scores=%s",
        request_id or "direct",
        original_dimensions[0],
        original_dimensions[1],
        MODEL_PATH.resolve(),
        model.output_shape,
        class_names[ranked[0][0]],
        [(class_names[index], float(score)) for index, score in ranked],
    )
    return {
        "crop_label": crop_name,
        "predictions": predictions,
        "model_version": model_version,
        "low_confidence": predictions[0]["confidence"] < float(os.getenv("LOW_CONFIDENCE_THRESHOLD", "0.65")),
    }