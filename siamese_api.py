# ================================================
# CRITICAL: FORCE KERAS 2.x (MUST BE AT TOP)
# ================================================
import os
import sys
import tensorflow.keras as keras  # Public API for legacy mode

# Force TensorFlow to use legacy Keras 2.x
os.environ['TF_USE_LEGACY_KERAS'] = '1'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
os.environ['TF_FORCE_GPU_ALLOW_GROWTH'] = 'true'

# Block standalone Keras 3.x BEFORE any imports
import importlib.util
keras_spec = importlib.util.find_spec("keras")
if keras_spec:
    spec_origin = getattr(keras_spec, 'origin', '')
    if spec_origin and 'site-packages/keras/' in spec_origin:
        print("⚠️ Blocking standalone Keras 3.x")
        # Prevent keras from being imported
        if 'keras' in sys.modules:
            del sys.modules['keras']
        # Don't add a dummy - let TensorFlow handle it
        sys.modules['keras'] = None

# ================================================
# NOW SAFE TO IMPORT TENSORFLOW
# ================================================
import tensorflow as tf

# Get Keras version safely
keras_version = "2.14.0"  # Default for TF 2.14
try:
    # TF 2.14 bundles Keras 2.14 internally
    from tensorflow.python import keras as tf_keras
    keras_version = getattr(tf_keras, '__version__', '2.14.0')
except:
    pass

print(f"✅ Using TensorFlow: {tf.__version__}, Keras: {keras_version}")
if not keras_version.startswith('2.'):
    raise RuntimeError(f"❌ WRONG KERAS: {keras_version}. Need 2.x!")

# ================================================
# REST OF IMPORTS
# ================================================
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import numpy as np
import io
import traceback
import requests
from threading import Thread, Lock
import time

# Initialize FastAPI
app = FastAPI()

# Global variables for model state
model = None
model_loading = False
model_load_started = False
model_error = None
model_lock = Lock()
load_start_time = None

# ================================
# MODEL CONFIGURATION
# ================================
MODEL_PATH = "siamese_model.h5"
MODEL_URL = os.getenv("MODEL_URL", "https://github.com/mwangiiii/EduFace/releases/download/v0.2.0-alpha/siamese_model.h5")

# ================================
# MODEL DOWNLOAD
# ================================
def download_model():
    """Download model from GitHub release"""
    if os.path.exists(MODEL_PATH):
        file_size = os.path.getsize(MODEL_PATH) / (1024*1024)
        print(f"✅ Model exists: {MODEL_PATH} ({file_size:.2f}MB)")
        return
    
    try:
        print("=" * 60)
        print("🔽 DOWNLOADING MODEL")
        print(f"📍 URL: {MODEL_URL}")
        print("=" * 60)
        
        response = requests.get(MODEL_URL, stream=True, timeout=600, allow_redirects=True)
        response.raise_for_status()
        
        total_size = int(response.headers.get('content-length', 0))
        downloaded = 0
        
        print(f"📊 Size: {total_size/(1024*1024):.2f}MB")
        
        with open(MODEL_PATH, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total_size > 0:
                        percent = (downloaded / total_size) * 100
                        print(f"⏳ Progress: {percent:.1f}%", end='\r')
        
        file_size = os.path.getsize(MODEL_PATH) / (1024*1024)
        print(f"\n✅ Downloaded! Size: {file_size:.2f}MB")
        print("=" * 60)
        
    except Exception as e:
        print(f"❌ Download failed: {e}")
        traceback.print_exc()
        raise RuntimeError(f"Could not download model: {e}")

# ================================
# MODEL LOADING
# ================================
# ... (keep all existing code up to load_siamese_model() )

def load_siamese_model():
    """Load the Siamese model with custom L1Dist layer"""
    global model, model_loading, model_error, load_start_time
    with model_lock:
        if model is not None:
            print("✅ Model already loaded")
            return model
        if model_loading:
            print("⏳ Model loading in progress")
            return None
        model_loading = True
        load_start_time = time.time()

    try:
        print("=" * 60)
        print("🚀 MODEL INITIALIZATION")
        print("=" * 60)

        # Download model
        download_model()

        print("📦 Configuring TensorFlow...")
        try:
            tf.config.set_visible_devices([], 'GPU')
            tf.config.threading.set_inter_op_parallelism_threads(2)
            tf.config.threading.set_intra_op_parallelism_threads(2)
        except:
            pass
        print(f"✅ TensorFlow configured")
        print(f" TF version: {tf.__version__}")

        # Import Keras components (public for layers, internal for saving)
        print("📦 Loading Keras modules...")
        from tensorflow.keras.layers import Layer as TFLayer
        from tensorflow.keras.models import load_model as keras_load_model
        print("✅ Keras modules loaded")

        # Define custom L1 Distance layer
        print("🔧 Defining L1Dist layer...")
        class L1Dist(TFLayer):
            def __init__(self, **kwargs):
                super().__init__(**kwargs)

            def call(self, input_embedding, validation_embedding):
                return tf.math.abs(input_embedding - validation_embedding)

            def get_config(self):
                return super().get_config()

        # Load model using multiple approaches
        print(f"📂 Loading model: {MODEL_PATH}...")
        load_start = time.time()
        loaded_model = None
        errors = []

        # Approach 1: Standard keras load_model (public)
        try:
            print(" Attempt 1: Standard keras load_model...")
            loaded_model = keras_load_model(
                MODEL_PATH,
                custom_objects={'L1Dist': L1Dist},
                compile=False
            )
            print(" ✅ Success with standard loader")
        except Exception as e1:
            errors.append(f"Standard loader: {str(e1)[:200]}")

        # Approach 2: HDF5 format loader (internal import)
        if loaded_model is None:
            try:
                print(" Attempt 2: HDF5 format loader...")
                from tensorflow.python.keras.saving import hdf5_format  # Internal for legacy
                import h5py
                with h5py.File(MODEL_PATH, 'r') as f:
                    loaded_model = hdf5_format.load_model_from_hdf5(
                        f,
                        custom_objects={'L1Dist': L1Dist},
                        compile=False
                    )
                print(" ✅ Success with HDF5 loader")
            except Exception as e2:
                errors.append(f"HDF5 loader: {str(e2)[:200]}")

        # Approach 3: Manual H5 with batch_shape patch (internal model_from_json)
        if loaded_model is None:
            try:
                print(" Attempt 3: Manual H5 reconstruction with patching...")
                from tensorflow.python.keras.models import model_from_json  # Internal for legacy
                from tensorflow.python.keras.saving import hdf5_format  # Internal
                import h5py
                import json

                with h5py.File(MODEL_PATH, 'r') as f:
                    if 'model_config' not in f.attrs:
                        raise ValueError("No model_config")
                    model_config_bytes = f.attrs['model_config']
                    if isinstance(model_config_bytes, bytes):
                        model_config_bytes = model_config_bytes.decode('utf-8')
                    model_config = json.loads(model_config_bytes)

                    # Patch batch_shape
                    def patch_config(config):
                        patched = False
                        if isinstance(config, dict):
                            if 'batch_shape' in config:
                                batch_shape = config['batch_shape']
                                if isinstance(batch_shape, (list, tuple)) and len(batch_shape) >= 2:
                                    input_shape = batch_shape[1:]
                                    config['input_shape'] = tuple(input_shape)
                                    del config['batch_shape']
                                    print(f" 🔧 Patched: {batch_shape} -> {config['input_shape']}")
                                    patched = True
                            for key, value in list(config.items()):
                                if isinstance(value, (dict, list)):
                                    if isinstance(value, list):
                                        for item in value:
                                            if isinstance(item, dict) and patch_config(item):
                                                patched = True
                                    elif patch_config(value):
                                        patched = True
                        return patched

                    patched_any = patch_config(model_config)
                    if patched_any:
                        print(" ✅ Config patched")
                    else:
                        print(" ⚠️ No batch_shape")

                    patched_config_json = json.dumps(model_config)
                    loaded_model = model_from_json(
                        patched_config_json,
                        custom_objects={'L1Dist': L1Dist}
                    )

                    if 'model_weights' not in f:
                        raise ValueError("No model_weights")
                    hdf5_format.load_weights_from_hdf5_group(f['model_weights'], loaded_model.layers)
                print(" ✅ Success with manual reconstruction")
            except Exception as e3:
                errors.append(f"Manual reconstruction: {str(e3)[:200]}")

        # Approach 4: Manual recreation (public tf.keras, internal hdf5_format)
        if loaded_model is None:
            try:
                print(" Attempt 4: Manual recreation from notebook...")
                from tensorflow.python.keras.saving import hdf5_format  # Internal for weights
                import h5py

                # Recreate exact (public tf.keras)
                def make_embedding():
                    inp = tf.keras.Input(shape=(100, 100, 3), name='input_image')
                    c1 = tf.keras.layers.Conv2D(64, (10,10), activation='relu')(inp)
                    m1 = tf.keras.layers.MaxPooling2D((2,2), padding='same')(c1)
                    c2 = tf.keras.layers.Conv2D(128, (7,7), activation='relu')(m1)
                    m2 = tf.keras.layers.MaxPooling2D((2,2), padding='same')(c2)
                    c3 = tf.keras.layers.Conv2D(128, (4,4), activation='relu')(m2)
                    m3 = tf.keras.layers.MaxPooling2D((2,2), padding='same')(c3)
                    c4 = tf.keras.layers.Conv2D(256, (4,4), activation='relu')(m3)
                    f1 = tf.keras.layers.Flatten()(c4)
                    d1 = tf.keras.layers.Dense(4096, activation='sigmoid')(f1)
                    return tf.keras.Model(inputs=inp, outputs=d1, name='embedding')

                def make_siamese_model():
                    input_image = tf.keras.Input(name='input_img', shape=(100,100,3))
                    validation_image = tf.keras.Input(name='validation_img', shape=(100,100,3))
                    embedding_model = make_embedding()
                    siamese_layer = L1Dist(name='distance')
                    distances = siamese_layer(embedding_model(input_image), embedding_model(validation_image))
                    classifier = tf.keras.layers.Dense(1, activation='sigmoid')(distances)
                    return tf.keras.Model(inputs=[input_image, validation_image], outputs=classifier, name='SiameseNetwork')

                siamese_model = make_siamese_model()

                # Load weights (internal hdf5_format)
                with h5py.File(MODEL_PATH, 'r') as f:
                    if 'model_weights' not in f:
                        raise ValueError("No model_weights")
                    hdf5_format.load_weights_from_hdf5_group(f['model_weights'], siamese_model.layers)

                loaded_model = siamese_model
                print(" ✅ Success with manual recreation")
            except Exception as e4:
                errors.append(f"Manual recreation: {str(e4)[:200]}")

        if loaded_model is None:
            error_msg = "All loading approaches failed:\n" + "\n".join(errors)
            raise RuntimeError(error_msg)

        load_time = time.time() - load_start
        print(f"✅ Model loaded in {load_time:.1f}s")

        # Test
        print("🧪 Testing model...")
        test_input = np.random.rand(1, 100, 100, 3).astype(np.float32)
        test_pred = loaded_model.predict([test_input, test_input], verbose=0)
        print(f"✅ Test passed! Output: {test_pred[0][0]:.6f}")

        total_time = time.time() - load_start_time
        print("=" * 60)
        print(f"🎉 MODEL READY! ({total_time:.1f}s total)")
        print("=" * 60)

        with model_lock:
            model = loaded_model
            model_loading = False
        return loaded_model

    except Exception as e:
        with model_lock:
            model_error = str(e)
            model_loading = False
        elapsed = time.time() - load_start_time if load_start_time else 0
        print(f"❌ Failed after {elapsed:.1f}s: {e}")
        traceback.print_exc()
        raise
        
# ... (keep all remaining code unchanged)
# ================================
# BACKGROUND MODEL LOADER
# ================================
def trigger_model_load_background():
    """Start model loading in background thread"""
    global model_load_started
    
    with model_lock:
        if model_load_started or model is not None:
            return
        model_load_started = True
    
    print("🔄 Starting background model load...")
    thread = Thread(target=load_siamese_model, daemon=True)
    thread.start()

# ================================
# STARTUP EVENT
# ================================
@app.on_event("startup")
async def startup_event():
    """Initialize on server startup"""
    print("=" * 60)
    print("🚀 FastAPI Starting")
    print("=" * 60)
    print(f"Python: {sys.version.split()[0]}")
    print(f"TensorFlow: {tf.__version__}")
    print(f"Keras: {keras_version}")
    print(f"Working dir: {os.getcwd()}")
    print(f"Model URL: {MODEL_URL}")
    
    trigger_model_load_background()
    
    print("✅ Server ready")
    print("⏳ Model loading in background (check /health)")
    print("=" * 60)

# ================================
# IMAGE PREPROCESSING
# ================================
def preprocess_image(image_bytes):
    """
    Preprocess image to match training format
    
    Args:
        image_bytes: Raw JPEG bytes
        
    Returns:
        numpy array: (100, 100, 3) normalized to [0, 1]
    """
    try:
        # Decode JPEG using TensorFlow (matches training)
        img = tf.io.decode_jpeg(image_bytes, channels=3)
        
        # Resize to 100x100 (no center crop)
        img = tf.image.resize(img, (100, 100))
        
        # Normalize to [0, 1]
        img = tf.cast(img, tf.float32) / 255.0
        
        # Convert to numpy
        img_array = img.numpy()
        
        # Validate
        if img_array.shape != (100, 100, 3):
            raise ValueError(f"Wrong shape: {img_array.shape}")
        
        if img_array.min() < 0 or img_array.max() > 1:
            raise ValueError(f"Values out of [0,1]: [{img_array.min()}, {img_array.max()}]")
        
        return img_array
        
    except Exception as e:
        raise ValueError(f"Preprocessing failed: {e}")

# ================================
# API ENDPOINTS
# ================================

@app.get("/")
def root():
    """Root endpoint - health check"""
    elapsed = None
    if load_start_time:
        elapsed = time.time() - load_start_time
    
    status = (
        "ready" if model is not None else
        "loading" if model_loading else
        "not_started" if not model_load_started else
        "error"
    )
    
    return {
        "status": status,
        "message": "EduFace Siamese API",
        "model_loaded": model is not None,
        "model_loading": model_loading,
        "loading_time_seconds": round(elapsed, 1) if elapsed else None,
        "error": model_error,
        "tensorflow_version": tf.__version__,
        "keras_version": keras_version
    }

@app.get("/health")
def health():
    """Detailed health check"""
    elapsed = None
    if load_start_time:
        elapsed = time.time() - load_start_time
    
    return {
        "server_status": "healthy",
        "model_status": (
            "ready" if model is not None else
            "loading" if model_loading else
            "not_started" if not model_load_started else
            "error"
        ),
        "model_loaded": model is not None,
        "model_loading": model_loading,
        "model_path": MODEL_PATH,
        "model_exists": os.path.exists(MODEL_PATH),
        "model_size_mb": f"{os.path.getsize(MODEL_PATH) / (1024*1024):.2f}" if os.path.exists(MODEL_PATH) else None,
        "loading_time_seconds": round(elapsed, 1) if elapsed else None,
        "error": model_error,
        "tensorflow_version": tf.__version__,
        "keras_version": keras_version,
        "preprocessing": "TensorFlow (tf.io.decode_jpeg + tf.image.resize)"
    }

@app.post("/predict")
async def predict(file1: UploadFile = File(...), file2: UploadFile = File(...)):
    """
    Compare two face images
    
    Args:
        file1: First JPEG image
        file2: Second JPEG image
        
    Returns:
        JSON with similarity score (0-1)
    """
    
    # Check model status
    if model_loading:
        elapsed = time.time() - load_start_time if load_start_time else 0
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Model still loading",
                "loading_time_seconds": round(elapsed, 1),
                "message": "Please wait and check /health"
            }
        )
    
    if model is None:
        error_msg = f"Model failed: {model_error}" if model_error else "Model not loaded"
        raise HTTPException(status_code=503, detail=error_msg)
    
    try:
        print("\n" + "="*60)
        print("🔍 PREDICTION REQUEST")
        print("="*60)
        
        # Read files
        img1_bytes = await file1.read()
        img2_bytes = await file2.read()
        
        print(f"📥 Files: {file1.filename} ({len(img1_bytes)}b), {file2.filename} ({len(img2_bytes)}b)")
        
        # Validate not empty
        if not img1_bytes or not img2_bytes:
            raise HTTPException(status_code=400, detail="Empty file(s)")
        
        # Validate JPEG magic bytes (FF D8 FF)
        if len(img1_bytes) < 3 or len(img2_bytes) < 3:
            raise HTTPException(status_code=400, detail="Files too small")
        
        magic1 = f"{img1_bytes[0]:02x}{img1_bytes[1]:02x}{img1_bytes[2]:02x}"
        magic2 = f"{img2_bytes[0]:02x}{img2_bytes[1]:02x}{img2_bytes[2]:02x}"
        
        print(f"🔍 Magic bytes: {magic1}, {magic2}")
        
        if not (magic1.startswith('ffd8ff') and magic2.startswith('ffd8ff')):
            return JSONResponse({
                "error": "Invalid JPEG format",
                "file1_magic": magic1,
                "file2_magic": magic2,
                "similarity_score": 0,
                "verified": False
            }, status_code=400)
        
        # Preprocess
        print("🔧 Preprocessing...")
        img1 = preprocess_image(img1_bytes)
        img2 = preprocess_image(img2_bytes)
        
        # Add batch dimension
        img1_batch = np.expand_dims(img1, axis=0)
        img2_batch = np.expand_dims(img2, axis=0)
        
        print(f"📊 Input shapes: {img1_batch.shape}, {img2_batch.shape}")
        
        # Predict
        print("🤖 Predicting...")
        prediction = model.predict([img1_batch, img2_batch], verbose=0)
        similarity = float(prediction[0][0])
        
        print(f"✅ Similarity: {similarity:.6f}")
        
        # Determine match
        threshold = 0.8
        is_similar = similarity >= threshold
        confidence = "high" if similarity >= 0.9 else "medium" if similarity >= 0.7 else "low"
        
        result = {
            "similarity_score": similarity,
            "similarity": similarity,
            "is_similar": is_similar,
            "verified": is_similar,
            "threshold": threshold,
            "confidence": confidence,
            "decision": "MATCH" if is_similar else "NO_MATCH",
            "message": f"{'Match' if is_similar else 'No match'} (score: {similarity:.4f})"
        }
        
        print(f"📤 Result: {result['decision']}")
        print("="*60 + "\n")
        
        return JSONResponse(result)
    
    except ValueError as e:
        print(f"❌ Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ Prediction error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")
    

# Add this to your main.py (after the /predict endpoint)

@app.post("/batch-verify")
async def batch_verify(
    anchors: list[UploadFile] = File(...),
    negatives: list[UploadFile] = File(...)
):
    """
    Batch verification: Compare multiple anchor images against multiple negative images
    
    Args:
        anchors: List of live capture images (2-10 images)
        negatives: List of enrolled reference images (15+ images)
        
    Returns:
        JSON with verification decision and detailed metrics
    """
    
    # Check model status
    if model_loading:
        elapsed = time.time() - load_start_time if load_start_time else 0
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Model still loading",
                "loading_time_seconds": round(elapsed, 1),
                "message": "Please wait and check /health"
            }
        )
    
    if model is None:
        error_msg = f"Model failed: {model_error}" if model_error else "Model not loaded"
        raise HTTPException(status_code=503, detail=error_msg)
    
    try:
        print("\n" + "="*60)
        print("🔍 BATCH VERIFICATION REQUEST")
        print("="*60)
        
        # Validate counts
        if len(anchors) < 1:
            raise HTTPException(status_code=400, detail="Need at least 1 anchor image")
        if len(negatives) < 15:
            raise HTTPException(status_code=400, detail=f"Need at least 15 negative images (got {len(negatives)})")
        
        print(f"📥 Anchors: {len(anchors)}, Negatives: {len(negatives)}")
        
        # Preprocess all anchor images
        print("🔧 Preprocessing anchor images...")
        anchor_arrays = []
        for i, anchor in enumerate(anchors):
            try:
                img_bytes = await anchor.read()
                img_array = preprocess_image(img_bytes)
                anchor_arrays.append(img_array)
                print(f"  ✅ Anchor {i+1}/{len(anchors)}")
            except Exception as e:
                print(f"  ⚠️ Anchor {i+1} failed: {e}")
                continue
        
        if len(anchor_arrays) == 0:
            raise HTTPException(status_code=400, detail="No valid anchor images")
        
        # Preprocess all negative images
        print("🔧 Preprocessing negative images...")
        negative_arrays = []
        for i, negative in enumerate(negatives):
            try:
                img_bytes = await negative.read()
                img_array = preprocess_image(img_bytes)
                negative_arrays.append(img_array)
                if (i + 1) % 5 == 0:
                    print(f"  ✅ Negatives {i+1}/{len(negatives)}")
            except Exception as e:
                print(f"  ⚠️ Negative {i+1} failed: {e}")
                continue
        
        if len(negative_arrays) < 15:
            raise HTTPException(
                status_code=400, 
                detail=f"Not enough valid negative images ({len(negative_arrays)}/15)"
            )
        
        print(f"✅ Preprocessed: {len(anchor_arrays)} anchors, {len(negative_arrays)} negatives")
        
        # === BATCH PREDICTION: All anchors vs All negatives ===
        print("🤖 Running batch predictions...")
        
        all_scores = []
        total_comparisons = 0
        
        for i, anchor in enumerate(anchor_arrays):
            anchor_batch = np.expand_dims(anchor, axis=0)
            
            # Compare this anchor against all negatives
            for j, negative in enumerate(negative_arrays):
                negative_batch = np.expand_dims(negative, axis=0)
                
                # Predict similarity
                prediction = model.predict([anchor_batch, negative_batch], verbose=0)
                score = float(prediction[0][0])
                all_scores.append(score)
                total_comparisons += 1
        
        print(f"✅ Completed {total_comparisons} comparisons")
        
        # === CALCULATE METRICS ===
        if len(all_scores) == 0:
            raise HTTPException(status_code=500, detail="No predictions generated")
        
        all_scores_array = np.array(all_scores)
        max_similarity = float(np.max(all_scores_array))
        avg_similarity = float(np.mean(all_scores_array))
        min_similarity = float(np.min(all_scores_array))
        std_similarity = float(np.std(all_scores_array))
        
        # Count matches above threshold
        THRESHOLD = 0.8
        matches_above_threshold = int(np.sum(all_scores_array >= THRESHOLD))
        
        # Verification decision
        verified = max_similarity >= THRESHOLD
        
        print(f"📊 Results:")
        print(f"  Max: {max_similarity:.4f}")
        print(f"  Avg: {avg_similarity:.4f}")
        print(f"  Min: {min_similarity:.4f}")
        print(f"  Matches ≥{THRESHOLD}: {matches_above_threshold}/{total_comparisons}")
        print(f"  Decision: {'✅ VERIFIED' if verified else '❌ REJECTED'}")
        
        # Determine confidence level
        if max_similarity >= 0.95:
            confidence = "very_high"
        elif max_similarity >= 0.85:
            confidence = "high"
        elif max_similarity >= 0.75:
            confidence = "medium"
        else:
            confidence = "low"
        
        result = {
            "verified": verified,
            "confidence": max_similarity,
            "max_similarity": max_similarity,
            "avg_similarity": avg_similarity,
            "min_similarity": min_similarity,
            "std_similarity": std_similarity,
            "match_count": matches_above_threshold,
            "total_comparisons": total_comparisons,
            "threshold": THRESHOLD,
            "confidence_level": confidence,
            "anchors_processed": len(anchor_arrays),
            "negatives_processed": len(negative_arrays),
            "message": f"{'Verification successful' if verified else 'Verification failed'} (max: {max_similarity:.4f})",
            "all_scores_summary": {
                "percentile_95": float(np.percentile(all_scores_array, 95)),
                "percentile_75": float(np.percentile(all_scores_array, 75)),
                "percentile_50": float(np.percentile(all_scores_array, 50)),
                "percentile_25": float(np.percentile(all_scores_array, 25))
            }
        }
        
        print("="*60 + "\n")
        
        return JSONResponse(result)
    
    except ValueError as e:
        print(f"❌ Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ Batch verification error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Batch verification failed: {str(e)}")



@app.get("/test")
def test_endpoint():
    """Self-test endpoint"""
    if model is None:
        return {"error": "Model not loaded"}
    
    try:
        # Create test image
        test_img = np.ones((100, 100, 3), dtype=np.uint8) * 128
        encoded = tf.io.encode_jpeg(test_img).numpy()
        
        # Preprocess
        processed = preprocess_image(encoded)
        
        # Test self-similarity
        batch = np.expand_dims(processed, axis=0)
        pred = model.predict([batch, batch], verbose=0)
        score = float(pred[0][0])
        
        return {
            "test": "successful",
            "self_similarity_score": score,
            "expected": "> 0.9",
            "passed": score > 0.7,
            "note": "Identical images should score > 0.9"
        }
    except Exception as e:
        return {"error": str(e), "traceback": traceback.format_exc()}