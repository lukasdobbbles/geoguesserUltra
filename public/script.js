async function initialize() {
  const resp = await fetch("/api/getRandomLocation");
  let location = await resp.json();
  const guessButton = document.getElementById("guess");
  const map = new google.maps.Map(document.getElementById("map"), {
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
    guessButton.disabled = false;
    if (!guessMarker) {
      guessMarker = new AdvancedMarkerElement({
        map,
        position: mapsMouseEvent.latLng,
        gmpDraggable: true,
      });
    } else {
      guessMarker.position = mapsMouseEvent.latLng;
    }
  });

  guess.addEventListener("click", (e) => {
    const distance = google.maps.geometry.spherical.computeDistanceBetween(
      guessMarker.position,
      location
    );
    const modal = document.createElement("div");
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
    message.innerText = `You were ${distanceText} away from the actual location.`;
    modalContent.appendChild(message);
    const playAgain = document.createElement("button");
    playAgain.innerText = "Play Again";
    playAgain.classList = "is-fullwidth button is-primary";
    modalContent.appendChild(playAgain);
    playAgain.addEventListener("click", async (e) => {
      playAgain.disabled = true;
      modalContent.innerHTML += `<svg width="90" height="90">
      <image xlink:href="/public/reload.svg" width="90" height="90" />
    </svg>`;
      const resp = await fetch("/api/getRandomLocation");
      const newLocation = await resp.json();
      panorama = new google.maps.StreetViewPanorama(
        document.getElementById("pano"),
        {
          position: newLocation,
          pov: {
            heading: 34,
            pitch: 10,
          },
        }
      );
      location = newLocation;
      document.body.removeChild(modal);
    });
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
    new AdvancedMarkerElement({
      map: answerMap,
      position: guessMarker.position,
    });
    new google.maps.Polyline({
      path: [location, guessMarker.position],
      geodesic: true,
      strokeColor: "#FF0000",
      strokeOpacity: 1.0,
      strokeWeight: 2,
      map: answerMap,
    });
    /*new google.maps.InfoWindow({
      content: `Actual Location`,
      position: location,
      map: answerMap,
    });
    new google.maps.InfoWindow({
      content: `Your Guess`,
      position: guessMarker.position,
      map: answerMap,
    });*/
    guessMarker.setMap(null);
    guessMarker = null;
  });

  map.setStreetView(panorama);
}

window.initialize = initialize;
