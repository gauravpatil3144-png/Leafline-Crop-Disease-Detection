
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

from predict import (
    InvalidImageError,
    ModelNotReadyError,
    model_status,
    predict_image,
)

import predict as prediction_module


# ==================================================
# FLASK CONFIGURATION
# ==================================================

app = Flask(__name__)

MAX_IMAGE_BYTES = int(
    os.getenv("MAX_IMAGE_BYTES", str(10 * 1024 * 1024))
)

app.config["MAX_CONTENT_LENGTH"] = MAX_IMAGE_BYTES


# ==================================================
# CORS CONFIGURATION
# ==================================================

# Render environment variable:
# FRONTEND_URL=https://your-frontend.vercel.app
#
# Multiple frontend URLs can be separated by commas.

allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

frontend_urls = os.getenv("FRONTEND_URL", "")

for origin in frontend_urls.split(","):
    origin = origin.strip()

    if origin and origin not in allowed_origins:
        allowed_origins.append(origin)

CORS(
    app,
    resources={
        r"/*": {
            "origins": allowed_origins,
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": [
                "Content-Type",
                "Authorization",
                "X-Request-ID",
            ],
            "expose_headers": ["X-Request-ID"],
        }
    },
)


# ==================================================
# HOMEPAGE
# ==================================================

@app.get("/")
def home():
    status = model_status()

    return jsonify({
        "project": "LeafLine AI",
        "description": "AI Crop Disease Detection API",
        "status": "running",
        "model_ready": status["ready"],
        "missing_artifacts": status["missing"],
        "endpoints": {
            "home": "/",
            "health": "/health",
            "predict": "/predict",
        },
        "prediction": {
            "method": "POST",
            "content_type": "multipart/form-data",
            "image_field": "image",
        },
    }), 200


# ==================================================
# HEALTH CHECK
# ==================================================

@app.get("/health")
def health():

    status = model_status()

    return jsonify({
        "status": "ok" if status["ready"] else "degraded",
        "model_ready": status["ready"],
        "missing_artifacts": status["missing"],
    }), 200


# ==================================================
# CROP DISEASE PREDICTION
# ==================================================

@app.post("/predict")
def predict():

    # Validate request ID
    request_id = request.headers.get("X-Request-ID", "")

    if (
        not request_id
        or len(request_id) > 64
        or not request_id.isascii()
        or any(
            not (
                character.isalnum()
                or character in "-_"
            )
            for character in request_id
        )
    ):
        request_id = uuid4().hex

    # Get uploaded image
    uploaded = request.files.get("image")

    if uploaded is None:
        return jsonify({
            "code": "IMAGE_REQUIRED",
            "message": (
                "Upload one image using the 'image' field."
            ),
            "request_id": request_id,
        }), 400

    # Read image bytes
    image_bytes = uploaded.read()

    if not image_bytes:
        return jsonify({
            "code": "EMPTY_IMAGE",
            "message": "The uploaded image is empty.",
            "request_id": request_id,
        }), 400

    try:

        # Perform AI prediction
        result = predict_image(
            image_bytes,
            request_id=request_id,
        )

        response = jsonify(result)

        response.headers["X-Request-ID"] = request_id

        return response, 200

    except InvalidImageError as error:

        return jsonify({
            "code": "INVALID_IMAGE",
            "message": str(error),
            "request_id": request_id,
        }), 400

    except ModelNotReadyError as error:

        app.logger.error(
            "Model not ready. Request ID: %s. Error: %s",
            request_id,
            error,
        )

        return jsonify({
            "code": "MODEL_NOT_READY",
            "message": str(error),
            "model_ready": False,
            "request_id": request_id,
        }), 503

    except Exception:

        app.logger.exception(
            "Unexpected prediction error. Request ID: %s",
            request_id,
        )

        return jsonify({
            "code": "INTERNAL_SERVER_ERROR",
            "message": (
                "An unexpected error occurred during prediction."
            ),
            "request_id": request_id,
        }), 500


# ==================================================
# IMAGE SIZE ERROR HANDLER
# ==================================================

@app.errorhandler(413)
def too_large(_error):

    max_size_mb = MAX_IMAGE_BYTES / (1024 * 1024)

    return jsonify({
        "code": "IMAGE_TOO_LARGE",
        "message": (
            f"Image must be {max_size_mb:g} MB or smaller."
        ),
    }), 413


# ==================================================
# 404 ERROR HANDLER
# ==================================================

@app.errorhandler(404)
def not_found(_error):

    return jsonify({
        "code": "NOT_FOUND",
        "message": "The requested endpoint does not exist.",
        "available_endpoints": [
            "/",
            "/health",
            "/predict",
        ],
    }), 404


# ==================================================
# APPLICATION STARTUP
# ==================================================

if __name__ == "__main__":

    app.logger.info(
        "AI runtime: python=%s, predict_module=%s, "
        "artifacts_present=%s",
        sys.executable,
        prediction_module.__file__,
        model_status()["ready"],
    )

    app.run(
        host=os.getenv("AI_HOST", "0.0.0.0"),
        port=int(os.getenv("AI_PORT", "8000")),
        debug=False,
    )
