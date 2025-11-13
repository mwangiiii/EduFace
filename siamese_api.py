from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from keras.models import load_model
import tensorflow as tf
from keras.layers import Layer
import numpy as np
from PIL import Image
import io
import os
import gdown  # <-- for downloading from Google Drive

app = FastAPI()

# ================================
# 1. MODEL DOWNLOAD SECTION
# ================================
MODEL_PATH = "siamese_model.h5"
# Convert your Drive "view" link to a direct-download link:
MODEL_URL = "https://drive.google.com/uc?id=1BxfoPP9UPx5okXed-hw6-cei812A6jLW"

# If model not found, download it
if not os.path.exists(MODEL_PATH):
    print("🔽 Downloading model from Google Drive...")
    gdown.download(MODEL_URL, MODEL_PATH, quiet=False)
    print("✅ Model downloaded successfully!")

# ================================
# 2. CUSTOM LAYER DEFINITION
# ================================
class L1Dist(Layer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
    
    def call(self, input_embedding, validation_embedding):
        return tf.math.abs(input_embedding - validation_embedding)

# ================================
# 3. LOAD MODEL
# ================================
model = load_model(MODEL_PATH, custom_objects={'L1Dist': L1Dist})
print("✅ Siamese model loaded successfully!")

# ================================
# 4. IMAGE PREPROCESSING
# ================================
def preprocess_image(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    img = img.resize((100, 100))
    img_array = np.array(img) / 255.0
    img_array = np.expand_dims(img_array, axis=0)
    return img_array

# ================================
# 5. PREDICTION ENDPOINT
# ================================
@app.post("/predict")
def predict(file1: UploadFile = File(...), file2: UploadFile = File(...)):
    image1_bytes = file1.file.read()
    image2_bytes = file2.file.read()
    img1 = preprocess_image(image1_bytes)
    img2 = preprocess_image(image2_bytes)
    
    prediction = model.predict([img1, img2])
    similarity = float(prediction[0][0])
    
    return JSONResponse({"similarity_score": similarity})

# To run locally:
# uvicorn siamese_api:app --reload
