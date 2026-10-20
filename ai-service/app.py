import os
import sys
import logging
from uuid import uuid4

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

from predict import InvalidImageError, ModelNotReadyError, model_status, predict_image
import predict as prediction_module

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = int(os.getenv("MAX_IMAGE_BYTES", str(10 * 1024 * 1024)))
CORS(app, resources={r"/*": {"origins": ["http://localhost:5173"]}})


@app.get("/health")
def health():
    status = model_status()
    return jsonify({"status": "ok", "model_ready": status["ready"], "missing_artifacts": status["missing"]})


@app.post("/predict")
def predict():
    request_id = request.headers.get("X-Request-ID", "")
    if (
        not request_id
        or len(request_id) > 64
        or not request_id.isascii()
        or any(not (character.isalnum() or character in "-_") for character in request_id)
    ):
        request_id = uuid4().hex
    uploaded = request.files.get("image")
    if uploaded is None:
        return jsonify({"code": "IMAGE_REQUIRED", "message": "Upload one image using the 'image' field."}), 400
    try:
        result = predict_image(uploaded.read(), request_id=request_id)
        response = jsonify(result)
        response.headers["X-Request-ID"] = request_id
        return response
    except InvalidImageError as error:
        return jsonify({"code": "INVALID_IMAGE", "message": str(error)}), 400
    except ModelNotReadyError as error:
        return jsonify({"code": "MODEL_NOT_READY", "message": str(error), "model_ready": False}), 503


@app.errorhandler(413)
def too_large(_error):
    return jsonify({"code": "IMAGE_TOO_LARGE", "message": "Image must be 10 MB or smaller."}), 413


if __name__ == "__main__":
    app.logger.info(
        "AI runtime: python=%s, predict_module=%s, artifacts_present=%s",
        sys.executable,
        prediction_module.__file__,
        model_status()["ready"],
    )
    app.run(host=os.getenv("AI_HOST", "127.0.0.1"), port=int(os.getenv("AI_PORT", "8000")), debug=False)