const socket = io();
const createRoomBtn = document.getElementById("create_room_btn");
const joinRoomBtn = document.getElementById("join_room_btn");
const roomID = document.getElementById("roomID");
const joinLogic = document.getElementById("join_logic");
const gameLogic = document.getElementById("game_logic");
const roomCode = document.getElementById("roomCode");
const guessButton = document.getElementById("guess");
const mapContainer = document.getElementById("map");
const countdownText = document.getElementById("countdown");
const roundCount = document.getElementById("roundCount");
const intermissionLogic = document.getElementById("intermission_logic");
let roundCountNum;
const modal = document.getElementById("modal");

createRoomBtn.addEventListener("click", () => {
  socket.emit("create_room");
});

joinRoomBtn.addEventListener("click", () => {
  socket.emit("join_room", { roomID: roomID.value });
});

socket.on("connect", function () {
  console.log("connected...");
});

socket.on("joined_room", (roomCodeVal) => {
  joinLogic.style.display = "none";
  intermissionLogic.style.display = "block";
  roundCountNum = 1;
  roomCode.innerText = "Room code: " + roomCodeVal;
  roundCount.innerText = `round 1/10`;
});

socket.on("new_location", (newLoc) => {
  roundCountNum++;
  gameLogic.style.display = "block";
  intermissionLogic.style.display = "none";
  roundCount.innerText = `round ${roundCountNum}/10`;
  initLocation(newLoc);
  let count = 30;
  const countdownInterval = setInterval(() => {
    countdownText.innerText = count + " seconds left";
    count -= 1;
    if (count == 0) clearInterval(countdownInterval);
  }, 1000);
  modal.innerHTML = "";
});

socket.on("game_end", (game) => {
  gameLogic.style.display = "none";
  const gameSummary = document.createElement("div");
  const summaryText = document.createElement("h1");
  let txt = `Winner: ${game["winner"]}`;
  game.players.forEach((player) => {
    txt += player.user.username + "'s points: " + player.points;
  });
  summaryText.innerText = gameSummary.appendChild(summaryText);

  document.body.appendChild(gameSummary);
});

async function initLocation(location) {
  const map = new google.maps.Map(mapContainer, {
    center: { lat: 0, lng: 0 },
    streetViewControl: false,
    zoom: 0,
    mapId: "4504f8b37365c3d0",
  });

  const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary(
    "marker"
  );

  let panorama = new google.maps.StreetViewPanorama(
    document.getElementById("pano"),
    {
      position: location,
      pov: {
        heading: 34,
        pitch: 10,
      },
    }
  );

  let guessMarker;
  map.addListener("click", (mapsMouseEvent) => {
    if (guessButton.disabled) return;
    if (guessMarker) {
      guessMarker.position = mapsMouseEvent.latLng;
      return;
    }

    guessMarker = new AdvancedMarkerElement({
      map,
      position: mapsMouseEvent.latLng,
      gmpDraggable: true,
    });
  });

  let distance;
  guessButton.addEventListener("click", () => {
    guessButton.disabled = true;
    distance = google.maps.geometry.spherical.computeDistanceBetween(
      guessMarker.position,
      location
    );
    socket.emit("guess", {
      distance,
      guessLocation: guessMarker.position,
    });
  });

  socket.on("round_info", (round) => {
    modal.classList = "modal is-active";
    const modalContent = document.createElement("div");
    modalContent.classList = "modal-content";
    const modalBackground = document.createElement("div");
    modalBackground.classList = "modal-background";
    modal.appendChild(modalBackground);
    const message = document.createElement("h1");
    let distanceText = "";
    if (distance > 10000) {
      distanceText = Math.round(distance / 1000) + " kilometers";
    } else {
      distanceText = Math.round(distance) + " meters";
    }
    message.innerText = `You were ${distanceText} away from the actual location. ${round["winner"]} won`;
    modalContent.appendChild(message);
    const answerMapDOM = document.createElement("div");
    answerMapDOM.style.height = "20rem";
    answerMapDOM.style.margin = "1rem 0";

    modalContent.appendChild(answerMapDOM);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    const answerMap = new google.maps.Map(answerMapDOM, {
      center: location,
      streetViewControl: false,
      zoom: 5,
      mapId: "rizzy",
    });
    const pinBackground = new PinElement({
      background: "green",
    });
    new AdvancedMarkerElement({
      map: answerMap,
      position: location,
      content: pinBackground.element,
    });

    round.guesses.forEach((guess) => {
      const infowindow = new google.maps.InfoWindow({
        content: guess.player + "'s guess",
      });
      const marker = new AdvancedMarkerElement({
        map: answerMap,
        position: guess.guess.guessLocation,
      });
      infowindow.open({
        anchor: marker,
        map,
      });
      new google.maps.Polyline({
        path: [location, guess.guess.guessLocation],
        geodesic: true,
        strokeColor: "#FF0000",
        strokeOpacity: 1.0,
        strokeWeight: 2,
        map: answerMap,
      });
    });

    guessMarker.setMap(null);
    guessMarker = null;
  });

  map.setStreetView(panorama);
}
