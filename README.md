# Leafline Crop Disease Screening

Leafline is a crop-leaf screening application with a React/Vite client, an Express/MongoDB API, and a separate Flask/TensorFlow inference service. The current workspace has a trained MobileNetV2 model and labeled PlantVillage images under `ai-service/`; predictions come from that model, never from a placeholder.

## Project layout

```text
frontend/       React, Vite, Tailwind CSS, Router, Axios, Lucide
backend/        Express API, Mongoose models, JWT auth, image upload proxy
ai-service/    Flask inference API, MobileNetV2 training, dataset/models folders
```

Uploaded images are stored temporarily by the API, signature-checked, forwarded to the AI service, and deleted after inference. MongoDB stores authenticated users and prediction metadata, not image binaries.

## Prerequisites

- Node.js 20.19+ or 22.12+ and npm.
- MongoDB Community running locally, or a MongoDB Atlas connection string.
- Python 3.12 recommended for TensorFlow on Windows. Check installed interpreters with `py -0p`; install Python 3.12 if it is missing.
- Git, for retrieving the labeled image dataset.

## Configure the services

### Terminal 1: React frontend

From the workspace root in a VS Code terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

The app is served at `http://localhost:5173`. `VITE_API_URL` defaults to `http://localhost:5000/api`.

### Terminal 2: Express and MongoDB API

Open a second VS Code terminal, from the workspace root:

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Edit `backend/.env`: set `MONGODB_URI` to your local MongoDB or Atlas URI and replace `JWT_SECRET` with a newly generated random secret of at least 32 characters. `FRONTEND_URL` and `AI_SERVICE_URL` default to the local service URLs shown in `.env.example`. Then start the API:

```powershell
npm run dev
```

The API listens on `http://localhost:5000`. `GET /api/health` reports Express and MongoDB state without exposing connection details. Do not commit `.env` files.

### Terminal 3: Python AI service

Open a third VS Code terminal, from the workspace root:

```powershell
cd ai-service
& ".\tf-venv\Scripts\python.exe" app.py
```

Flask listens on `http://127.0.0.1:8000`. This command explicitly uses the existing Python 3.12 `tf-venv`; `GET /health` reports whether the model artifacts are present. Do not create another environment or reinstall TensorFlow for this project.

## Model and dataset

The workspace already has the trained model and class names at `ai-service/models/crop_mobilenet.keras` and `ai-service/models/class_names.json`. The supplied labeled image dataset is under `ai-service/dataset/PlantVillage/PlantVillage/`. Images are used as images; no CSV is involved. No retraining is required to run predictions.

The optional trainer extends the existing 15-class model with the four Cotton classes from `Dataset/cotton` at the project root. It reads the complete PlantVillage source at `ai-service/dataset/PlantVillage/PlantVillage`, groups perceptual near-duplicates before making train/validation/test splits, and preserves the original image directories. Training occurs in a versioned candidate folder; the working model is backed up and replaced only after held-out evaluation and a 19-output reload/prediction check succeed. The candidate folder contains `evaluation.json` and `confusion_matrix.csv`; the previous model files are kept under `ai-service/models/backups/`.

To deliberately train or update the model from the project root:

```powershell
& ".\ai-service\tf-venv\Scripts\python.exe" ".\ai-service\train.py" `
	--plantvillage-dataset ".\ai-service\dataset\PlantVillage\PlantVillage" `
	--cotton-dataset ".\Dataset\cotton" `
	--head-epochs 6 --fine-tune-epochs 5 --batch-size 32
```

The script reports held-out accuracy, macro and weighted precision/recall/F1, per-class metrics, and the confusion matrix. Native Windows TensorFlow uses the CPU in this environment, so training can take a while. Restart Flask after a successful activation to load the new model.

## Application behavior

- Public landing page, login, and registration; the workspace routes require a JWT session.
- Dashboard summary, user-scoped scan history with search/filter/pagination, disease reference library, and profile settings.
- Scanner accepts one JPG, PNG, or WebP image up to 10 MB, previews it, then sends it through Express to Flask. Express checks MIME and file signatures; Pillow validates image bytes and dimensions.
- A prediction is saved only after the inference service returns real model output. Results contain the top three model classes and scores, the model's low-confidence flag, and field-verification cautions. Model confidence is not disease probability.
- Unsupported file types, unreadable images, unavailable model artifacts, and service failures return explicit errors; no predicted result is fabricated.
- Disease-library text is general reference information, not a diagnosis or prescription. Confirm suspected disease with a qualified local agronomist or extension service. Do not apply crop treatments based only on this screening; follow local regulations and product labels.

## API routes

`POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `PATCH /api/auth/me`.

Authenticated prediction routes: `POST /api/predictions` with multipart field `image`, `GET /api/predictions?page=1&limit=10`, `GET /api/predictions/:id`, `DELETE /api/predictions/:id`, `GET /api/predictions/summary`, and `GET /api/predictions/status`. `POST` forwards the image to Flask, stores the returned prediction in MongoDB, and returns `{ success, data }`. History and deletion are scoped to the authenticated user. The older `/api/scans` routes remain available for existing clients.

AI service routes: `GET /health` and `POST /predict` with multipart field `image`.

## Local limitations

MongoDB must be running or reachable for account, history, and prediction-save operations. Configure the Atlas URI in `backend/.env` if you are not using the local `crop_disease_db` database. The trained model and dataset are local ignored assets and are not committed to source control.

## Verify the prediction workflow

Start MongoDB, then run the three services in separate terminals using the commands above. In Terminal 2, `GET /api/health` should report `database: "connected"`; in Terminal 3, `GET /health` should report `model_ready: true`.

Register or sign in through the frontend. In PowerShell, you can also get a token and upload the sample image directly:

```powershell
$email = "farmer-test-$([guid]::NewGuid().ToString('N'))@example.com"
$register = Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/auth/register" -ContentType "application/json" -Body (@{ name = "Test Farmer"; email = $email; password = "Change-This-Test-Password-123!" } | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($register.token)" }
$imagePath = "C:\Crop_Disease_Detection_Sys\ai-service\dataset\PlantVillage\PlantVillage\Tomato_Bacterial_spot\00416648-be6e-4bd4-bc8d-82f43f8a7240___GCREC_Bact.Sp 3110.JPG"
$prediction = curl.exe -sS -X Post "http://localhost:5000/api/predictions" -H "Authorization: Bearer $($register.token)" -F "image=@$imagePath" | ConvertFrom-Json
$prediction.data
Invoke-RestMethod -Uri "http://localhost:5000/api/predictions?page=1&limit=10" -Headers $headers
$id = $prediction.data._id
Invoke-RestMethod -Uri "http://localhost:5000/api/predictions/$id" -Headers $headers
Invoke-RestMethod -Method Delete -Uri "http://localhost:5000/api/predictions/$id" -Headers $headers
```

The `POST` response should contain the real top-three classes, confidence scores, model version, MongoDB ID, and timestamp. To verify MongoDB directly, run `mongosh "mongodb://127.0.0.1:27017/crop_disease_db" --eval "db.predictions.find().sort({createdAt:-1}).limit(5).forEach(printjson)"`.

Failure checks: omit `-F "image=@..."` to receive HTTP 400; upload a text file renamed as `.jpg` to verify signature rejection; request `/api/predictions/not-an-object-id` with a valid bearer token to receive HTTP 400; stop Flask to verify HTTP 503 on upload; use an unreachable `MONGODB_URI` to verify startup logs a connection failure and does not start an API that cannot persist results.
