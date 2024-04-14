import requests
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
import dotenv
dotenv.load_dotenv()
import os
import time

client = MongoClient(os.getenv("URI"), server_api=ServerApi('1'))
random_location_mining = client.get_database("geo").get_collection("random_location_mining")                                                                                                     
last_creation = time.time()
duration_list = []
def find():
    resp = requests.get("https://api.3geonames.org/.json?randomland=yes")
    data = resp.json()
    if data['nearest']['latt'] == {}:
        return find()
    
    pos = {
        'lat': float(data['nearest']['latt']),
        'lng': float(data['nearest']['longt'])
    }
    staticImg = requests.get(f"https://maps.googleapis.com/maps/api/streetview?size=400x400&location={pos['lat']},{pos['lng']}&fov=80&heading=70&pitch=0&key={os.getenv('API_KEY')}&return_error_code=true")
    if staticImg.status_code != 200:
        return find()
    return pos

while True:
    random_location_mining.insert_one(find())
    find_duration = (time.time() - last_creation) 
    duration_list.append(find_duration)
    print(f"""Found a new location. It took {find_duration} seconds.
The average is {sum(duration_list) / len(duration_list)} seconds.
Number of locations found: {len(duration_list)}""")
    last_creation = time.time()
