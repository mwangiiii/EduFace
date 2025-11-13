from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from keras.models import load_model
import tensorflow as tf
from keras.layers import Layer
import numpy as np
from PIL import Image
import io

app = FastAPI()

# Define the custom L1Dist layer (fixed call signature)
class L1Dist(Layer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
    
    def call(self, input_embedding, validation_embedding):  # Accept two positional args directly
        return tf.math.abs(input_embedding - validation_embedding)

# Load the Siamese model with custom_objects
model = load_model("siamese_model.h5", custom_objects={'L1Dist': L1Dist})

# Helper function to preprocess images (MATCH NOTEBOOK: 100x100)
def preprocess_image(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    img = img.resize((100, 100))  # FIXED: Match notebook resize
    img_array = np.array(img) / 255.0
    img_array = np.expand_dims(img_array, axis=0)
    return img_array

@app.post("/predict")
def predict(file1: UploadFile = File(...), file2: UploadFile = File(...)):
    image1_bytes = file1.file.read()
    image2_bytes = file2.file.read()
    img1 = preprocess_image(image1_bytes)
    img2 = preprocess_image(image2_bytes)
    # Siamese expects a list of two images
    prediction = model.predict([img1, img2])
    similarity = float(prediction[0][0])
    return JSONResponse({"similarity_score": similarity})  # FIXED: Consistent key

# To run: uvicorn siamese_api:app --reload