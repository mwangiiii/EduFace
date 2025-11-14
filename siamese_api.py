from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from keras.models import load_model
import tensorflow as tf
from keras.layers import Layer
import numpy as np
from PIL import Image
import io
import os
import gdown

app = FastAPI()

# ================================
# 1. MODEL DOWNLOAD SECTION
# ================================
MODEL_PATH = "siamese_model.h5"
MODEL_URL = "https://drive.google.com/uc?id=1BxfoPP9UPx5okXed-hw6-cei812A6jLW"

# Only download if model doesn't exist
if not os.path.exists(MODEL_PATH):
    try:
        print("🔽 Downloading model from Google Drive...")
        gdown.download(MODEL_URL, MODEL_PATH, quiet=False)
        print("✅ Model downloaded successfully!")
    except Exception as e:
        print(f"❌ Failed to download model: {e}")
        print(f"Please download manually from: {MODEL_URL}")
        print(f"And place it at: {MODEL_PATH}")
        raise RuntimeError(f"Model download failed: {e}")
else:
    print(f"✅ Model already exists at {MODEL_PATH}")

# ================================
# 2. CUSTOM LAYER DEFINITION
# ================================
class L1Dist(Layer):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
    
    def call(self, input_embedding, validation_embedding):
        return tf.math.abs(input_embedding - validation_embedding)

# ================================
# 3. LOAD MODEL
# ================================
try:
    model = load_model(MODEL_PATH, custom_objects={'L1Dist': L1Dist})
    print("✅ Siamese model loaded successfully!")
except Exception as e:
    print(f"❌ Failed to load model: {e}")
    raise RuntimeError(f"Model loading failed: {e}")

# ================================
# 4. IMAGE PREPROCESSING
# ================================
def preprocess_image(image_bytes):
    """
    Preprocess image bytes for model input.
    Expected input: RGB image
    Output: Normalized numpy array of shape (1, 100, 100, 3)
    """
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        img = img.resize((100, 100))
        img_array = np.array(img, dtype=np.float32) / 255.0
        img_array = np.expand_dims(img_array, axis=0)
        return img_array
    except Exception as e:
        raise ValueError(f"Image preprocessing failed: {e}")

# ================================
# 5. API ENDPOINTS
# ================================
@app.get("/")
def root():
    """Health check endpoint"""
    return {"status": "ok", "message": "Siamese Network API is running"}

@app.get("/health")
def health():
    """Detailed health check"""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "model_path": MODEL_PATH
    }

@app.post("/predict")
async def predict(file1: UploadFile = File(...), file2: UploadFile = File(...)):
    """
    Compare two images using the Siamese network.
    
    Args:
        file1: First image file
        file2: Second image file
    
    Returns:
        JSON with similarity score (0-1, where 1 means identical)
    """
    try:
        # Read image bytes
        image1_bytes = await file1.read()
        image2_bytes = await file2.read()
        
        # Validate files are not empty
        if not image1_bytes or not image2_bytes:
            raise HTTPException(status_code=400, detail="One or both files are empty")
        
        # Preprocess images
        img1 = preprocess_image(image1_bytes)
        img2 = preprocess_image(image2_bytes)
        
        # Make prediction
        prediction = model.predict([img1, img2], verbose=0)
        similarity = float(prediction[0][0])
        
        # Determine if images are similar (threshold can be adjusted)
        threshold = 0.5
        is_similar = similarity >= threshold
        
        return JSONResponse({
            "similarity_score": similarity,
            "is_similar": is_similar,
            "threshold": threshold
        })
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

# To run locally:
# uvicorn siamese_api:app --reload --host 0.0.0.0 --port 8000