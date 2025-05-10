from flask import Flask
from flask_cors import CORS
from ultralytics import YOLO
import os
import ee
import json


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(BASE_DIR, 'best.pt')
model = YOLO(model_path)
app = Flask(__name__)
CORS(app)
crops = json.load(open(os.path.join(BASE_DIR, 'crops.json'), 'r'))



# Initialize EE with the service account email and the temporary credentials file
credentials = ee.ServiceAccountCredentials(
    "earth-engine-access@premium-buckeye-310022.iam.gserviceaccount.com",
    "/home/ubuntu/keys/google-service-account.json"
)
ee.Initialize(credentials)
print("done 7")

from satellitor_backend import routes

