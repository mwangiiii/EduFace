from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import numpy as np
from PIL import Image
import io
import os
import gdown
import sys
import traceback
import asyncio

# Initialize FastAPI first
app = FastAPI()

# Global variable to hold the model
model = None
model_loading = False
model_error = None

# ================================
# 1. MODEL DOWNLOAD & LOAD
# ================================
MODEL_PATH = "siamese_model.h5"
MODEL_URL = "https://drive.google.com/uc?id=1BxfoPP9UPx5okXed-hw6-cei812A6jLW"

def download_model():
    """Download model if it doesn't exist"""
    if not os.path.exists(MODEL_PATH):
        try:
            print("🔽 Downloading model from Google Drive...")
            gdown.download(MODEL_URL, MODEL_PATH, quiet=False)
            print("✅ Model downloaded successfully!")
        except Exception as e:
            print(f"❌ Failed to download model: {e}")
            raise RuntimeError(f"Model download failed: {e}")
    else:
        print(f"✅ Model already exists at {MODEL_PATH}")

def load_siamese_model():
    """Load the model with custom objects"""
    global model, model_loading, model_error
    
    try:
        print("📦 Importing TensorFlow and Keras...")
        # Set memory growth to avoid OOM
        import tensorflow as tf
        gpus = tf.config.list_physical_devices('GPU')
        if gpus:
            for gpu in gpus:
                tf.config.experimental.set_memory_growth(gpu, True)
        
        from keras.models import load_model
        from keras.layers import Layer
        print("✅ TensorFlow imported successfully")
        
        print("🔧 Defining custom L1Dist layer...")
        class L1Dist(Layer):
            def __init__(self, **kwargs):
                super().__init__(**kwargs)
            
            def call(self, input_embedding, validation_embedding):
                return tf.math.abs(input_embedding - validation_embedding)
        
        print(f"📂 Loading model from {MODEL_PATH}...")
        print(f"📊 Model file size: {os.path.getsize(MODEL_PATH) / (1024*1024):.2f} MB")
        
        loaded_model = load_model(
            MODEL_PATH, 
            custom_objects={'L1Dist': L1Dist},
            compile=False  # Skip compilation to speed up loading
        )
        
        print("✅ Siamese model loaded successfully!")
        print(f"📋 Model summary:")
        loaded_model.summary()
        
        model = loaded_model
        model_loading = False
        return loaded_model
        
    except Exception as e:
        model_error = str(e)
        model_loading = False
        print(f"❌ Failed to load model: {e}")
        print(traceback.format_exc())
        raise

async def load_model_async():
    """Load model in background"""
    global model_loading
    model_loading = True
    
    try:
        # Run the blocking load_model in a thread pool
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, download_model)
        await loop.run_in_executor(None, load_siamese_model)
        print("🎉 Model loaded successfully in background!")
    except Exception as e:
        print(f"💥 Background model loading failed: {e}")

# ================================
# 2. STARTUP EVENT
# ================================
@app.on_event("startup")
async def startup_event():
    """Start model loading in background"""
    print("🚀 Application starting...")
    print(f"Python version: {sys.version}")
    print(f"Working directory: {os.getcwd()}")
    
    # Start loading model in background - don't block startup
    asyncio.create_task(load_model_async())
    
    print("✅ Application started! Model loading in background...")

# ================================
# 3. IMAGE PREPROCESSING
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
# 4. API ENDPOINTS
# ================================
@app.get("/")
def root():
    """Health check endpoint"""
    status = "ready" if model is not None else "loading" if model_loading else "error"
    
    return {
        "status": status,
        "message": "Siamese Network API",
        "model_loaded": model is not None,
        "model_loading": model_loading,
        "error": model_error
    }

@app.get("/health")
def health():
    """Detailed health check"""
    return {
        "status": "healthy" if model is not None else "loading" if model_loading else "error",
        "model_loaded": model is not None,
        "model_loading": model_loading,
        "model_path": MODEL_PATH,
        "model_exists": os.path.exists(MODEL_PATH),
        "model_size_mb": f"{os.path.getsize(MODEL_PATH) / (1024*1024):.2f}" if os.path.exists(MODEL_PATH) else None,
        "error": model_error
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
    # Check if model is loaded
    if model_loading:
        raise HTTPException(
            status_code=503, 
            detail="Model is still loading. Please wait and try again in a few moments."
        )
    
    if model is None:
        error_msg = f"Model failed to load. Error: {model_error}" if model_error else "Model not loaded"
        raise HTTPException(status_code=503, detail=error_msg)
    
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
        print(f"Error during prediction: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")