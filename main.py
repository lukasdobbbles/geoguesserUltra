from flask import Flask, render_template, request, session
import dotenv
import requests
dotenv.load_dotenv()
import os
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from bson.json_util import dumps
from flask_socketio import SocketIO, join_room, emit
import random
import string
import time
import math

client = MongoClient(os.getenv("URI"), server_api=ServerApi('1'))
app = Flask(__name__, static_folder="public")
app.secret_key = os.getenv("SECRET_KEY")
socketio = SocketIO(app)
users = client.get_database("geo").get_collection("users")
random_locations = client.get_database("geo").get_collection("random_location_mining")
rooms = {}

@app.get("/")
def main():
    return render_template("index.html", user=session.get("user"))
    
@app.get("/play")
def play():
    return render_template("play.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        return render_template("login.html")
    user = users.find_one({
        "username": request.form["username"],
        "password": hash(request.form['password'])
    })
    if user:
        user = eval(dumps(user))
        session["user"] = user
        return render_template("index.html")
    return render_template("login.html", error="username or password incorrect")
    

@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "GET":
        return render_template("signup.html")

    user = users.find_one({
        "username": request.form["username"]
    })
    if user:
        return render_template("signup.html", error="someone already has the username " + request.form["username"])
    new_user = {
        "username": request.form["username"],
        "password": hash(request.form["password"]),
        "email": request.form["email"],
    }
    users.insert_one(new_user)
    new_user = eval(dumps(new_user))
    session["user"] = new_user
    return render_template("index.html")

@app.get("/duel")
def duelLobby():
    if "user" in session:
        return render_template("duel.html")
    return render_template("duel.html", error="you must be logged in to play duels")


@app.get("/api/getRandomLocation")
def getRandomLocation():
    return getRandLocation()

@socketio.on("create_room")
def createRoom():
    if "user" in session:
        roomCode = ''.join(random.choices(string.ascii_uppercase + string.digits, k=7))
        user = session["user"]
        rooms[roomCode] = {"open": True, "players": {user["username"]: {"user": user, "host": True}}, "rounds": []}
        join_room(roomCode)
        session["room_code"] = roomCode
        emit("joined_room", roomCode)

@socketio.on("guess")
def decideWinner(guess):
    rooms[session["room_code"]]["rounds"][-1]["guesses"].append({"player": session["user"]["username"], "guess": guess, "points": 0})
    if len(rooms[session["room_code"]]["rounds"][-1]["guesses"])  == 2:
       check_winner(session["room_code"])

def check_winner(roomID):
    winningDistance = math.inf
    winner = "Nobody"
    for guess in rooms[roomID]["rounds"][-1]["guesses"]:
        if guess["guess"]["distance"] < winningDistance:
            winner = guess["player"]
            winningDistance = guess["guess"]["distance"]
    rooms[session["room_code"]]["rounds"][-1]["winner"] = winner
    if winner != "Nobody":
        rooms[session["room_code"]]["players"][winner]["points"] += 1
    emit("round_info", rooms[session["room_code"]]["rounds"][-1], to=roomID)
    time.sleep(10)

def getRandLocation():
    loc = random_locations.aggregate([{"$sample": {"size": 1}}]).next()
    # needs to JSON serializable and I have to get rid of the ObjectID
    return {
        "lat": loc["lat"],
        "lng": loc["lng"]
    }

@socketio.on("join_room")
def joinRoom(data):
    if "user" in session:
        roomID = data["roomID"]
        if  roomID in rooms and rooms[roomID]["open"]:
            rooms[roomID]["open"] = False
            rooms[roomID]["players"][session.get("user")["username"]] = {"user": session.get("user"), "host": False, "points": 0}
            emit("joined_room", roomID)
            join_room(roomID)
            session["room_code"] = roomID
            roundCount = 0
            
            while roundCount <= 10:
                # random location
                newLoc = getRandLocation()
                rooms[roomID]["rounds"].append({
                    "location": newLoc,
                    "guesses": []
                })
                emit("new_location", newLoc, to=roomID)
                time.sleep(30)
                # intermission
                if "winner" not in rooms[session["room_code"]]["rounds"][-1]:
                    check_winner(roomID)
                roundCount += 1
            roundWinner = ""
            highestScore = -math.inf
            for player in rooms[roomID]["players"]:
                playerData = rooms[roomID]["players"][player]
                if playerData["points"] > highestScore:
                    roundWinner = playerData["user"]["username"]
            rooms[roomID]["winner"] = roundWinner
            emit("game_end", rooms[roomID])
if __name__ == "__main__":
    app.run(port=os.getenv("PORT"), host="0.0.0.0")
