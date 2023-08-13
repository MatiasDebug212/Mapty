'use strict';

// prettier-ignore
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

class Workout {
  date = new Date();
  id = Date.now() + ''.slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

// const run1 = new Running([39, -12], 5.2, 24, 178);
// const cycling2 = new Cycling([39, -12], 27, 95, 523);
// console.log(run1, cycling2);

//////////////////////////////////////
// Application ARCHITECTURE
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const popupMessage = document.querySelector('.popup__message');
const editIcon = document.querySelector('.workout__edit--icon');
const deleteAllIcon = document.querySelector('.workout__trash--icon');
const sortBtn = document.querySelector('.workout__sort--btn');
const yesBtn = document.querySelector('.popup__btn--yes');
const noBtn = document.querySelector('.popup__btn--no');
const allMarkerBtn = document.querySelector('.all__markers ');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #markers = [];
  // #sort = false;

  editDistance;
  editDuration;
  editCadence;
  editElevationGain;

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from localStorage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    containerWorkouts.addEventListener('click', this._edit.bind(this));
    containerWorkouts.addEventListener('click', this._delete.bind(this));
    deleteAllIcon.addEventListener('click', this._deleteAll.bind(this));
    sortBtn.addEventListener('click', this._sort.bind(this));
    allMarkerBtn.addEventListener('click', this._positionAllMarkers.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    console.log(`https://www.google.com/maps/@${latitude},${longitude}`);

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);
    // console.log(map);

    L.tileLayer('https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });

    // checking the workout length
    this._workoutCheck();
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _validInputs(...inputs) {
    return inputs.every(inp => Number.isFinite(inp));
  }

  _allPositive(...inputs) {
    return inputs.every(inp => inp > 0);
  }

  _newWorkout(e) {
    e.preventDefault();

    // Get data from the form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Check if data is valid
      if (
        !this._validInputs(distance, duration, cadence) ||
        !this._allPositive(distance, duration, cadence)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (
        !this._validInputs(distance, duration, elevation) ||
        !this._allPositive(distance, duration)
      )
        return alert('Inputs have to be positive numbers!');
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new object to workout array
    this.#workouts.push(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form + clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();

    // checking the workout length
    this._workoutCheck();
  }

  _renderWorkoutMarker(workout) {
    this.#markers.push(
      L.marker(workout.coords)
        .addTo(this.#map)
        .bindPopup(
          L.popup({
            maxWidth: 250,
            minWidth: 100,
            autoClose: false,
            closeOnClick: false,
            className: `${workout.type}-popup`,
          })
        )
        .setPopupContent(
          `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
        )
        .openPopup()
    );
  }

  _renderWorkout(workout) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="workout__edit--icon">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>

        

        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="workout__delete--icon">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>


      
      <h2 class="workout__title">${workout.description}</h2>
      <div class="workout__details">
        <span class="workout__icon">${
          workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
        }</span>
        <span class="workout__value">${workout.distance}</span>
        <span class="workout__unit">km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⏱</span>
        <span class="workout__value">${workout.duration}</span>
        <span class="workout__unit">min</span>
      </div>
    `;

    if (workout.type === 'running')
      html += `
            <div class="workout__details">
              <span class="workout__icon">⚡️</span>
              <span class="workout__value">${workout.pace.toFixed(1)}</span>
              <span class="workout__unit">min/km</span>
            </div>
            <div class="workout__details">
              <span class="workout__icon">🦶🏼</span>
              <span class="workout__value">${workout.cadence}</span>
              <span class="workout__unit">spm</span>
            </div>
          </li>
        `;

    if (workout.type === 'cycling')
      html += `
              <div class="workout__details">
                <span class="workout__icon">⚡️</span>
                <span class="workout__value">${workout.speed.toFixed(1)}</span>
                <span class="workout__unit">km/h</span>
              </div>
              <div class="workout__details">
                <span class="workout__icon">⛰</span>
                <span class="workout__value">${workout.elevationGain}</span>
                <span class="workout__unit">m</span>
              </div>
            </li>
          `;
    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // using the public interface
    // workout.click();
  }

  _editDistanceDuration() {
    this.editDistance = +prompt('Enter the new distance');
    this.editDuration = +prompt('Enter the new duration');
  }

  _editRender(el) {
    el.distance = this.editDistance;
    el.duration = this.editDuration;

    document.querySelectorAll('.workout').forEach(el => el.remove());
    this.#workouts.forEach(work => this._renderWorkout(work));
  }

  _editTypeRunning(el) {
    this._editDistanceDuration();
    this.editCadence = +prompt('Enter the new cadence');
    if (
      !this._validInputs(
        this.editDistance,
        this.editDuration,
        this.editCadence
      ) ||
      !this._allPositive(this.editDistance, this.editDuration, this.editCadence)
    ) {
      alert('Please enter a positive number!');
      return;
    }

    // el.distance = this.editDistance;
    // el.duration = this.editDuration;
    el.cadence = this.editCadence;
    el.pace = this.editDuration / this.editDistance;

    this._editRender.call(this, el);
  }

  _editTypeCycling(el) {
    this._editDistanceDuration();
    this.editElevationGain = +prompt('Enter the new cadence');

    if (
      !this._validInputs(
        this.editDistance,
        this.editDuration,
        this.editElevationGain
      ) ||
      !this._allPositive(this.editDistance, this.editDuration)
    ) {
      alert('Please enter a positive number!');
      return;
    }

    // el.distance = this.editDistance;
    // el.duration = this.editDuration;
    el.elevationGain = this.editElevationGain;
    el.speed = this.editDistance / (this.editDuration / 60);

    this._editRender(el);
  }

  _edit(e) {
    if (!e.target.classList.contains('workout__edit--icon')) return;

    const editEl = e.target.closest('.workout');
    const el = this.#workouts.find(work => work.id === editEl.dataset.id);

    if (el.type === 'running') this._editTypeRunning(el, editEl);
    if (el.type === 'cycling') this._editTypeCycling(el, editEl);

    localStorage.removeItem('workouts');
    this._setLocalStorage();
  }

  _delete(e) {
    if (!e.target.classList.contains('workout__delete--icon')) return;
    const delEl = e.target.closest('.workout');
    const delObjIndex = this.#workouts.findIndex(
      work => work.id === delEl.dataset.id
    );
    const delObj = this.#workouts.find(work => work.id === delEl.dataset.id);
    this.#map.removeLayer(this.#markers[delObjIndex]);
    this.#markers.splice(delObjIndex, 1);

    delEl.remove();
    this.#workouts.splice(delObjIndex, 1);

    localStorage.clear();
    this._setLocalStorage();

    // checking the workout length
    this._workoutCheck();
  }

  _workoutCheck() {
    this.#workouts.length > 0
      ? (document.querySelector('.workout__trash--icon').style.display =
          'block')
      : (document.querySelector('.workout__trash--icon').style.display =
          'none');
    this.#workouts.length > 1
      ? (sortBtn.style.display = 'block')
      : (sortBtn.style.display = 'none');
    this.#workouts.length > 0
      ? (allMarkerBtn.style.display = 'block')
      : (allMarkerBtn.style.display = 'none');
  }

  _yesBtnClicked() {
    popupMessage.classList.add('popup--hidden');
    // LOGIC
    this.#markers.forEach(mark => this.#map.removeLayer(mark));
    document.querySelectorAll('.workout').forEach(workout => workout.remove());
    this.#workouts.splice(0, this.#workouts.length + 1);
    this._workoutCheck();
    localStorage.clear();
  }

  _deleteAll() {
    // UI
    popupMessage.classList.remove('popup--hidden');
    yesBtn.addEventListener('click', this._yesBtnClicked.bind(this));
    noBtn.addEventListener('click', () =>
      popupMessage.classList.add('popup--hidden')
    );
  }

  _sort() {
    const sortArr = true
      ? this.#workouts.slice().sort((a, b) => b.distance - a.distance)
      : this.#workouts;
    document.querySelectorAll('.workout').forEach(workout => workout.remove());
    sortArr.forEach(sort => this._renderWorkout(sort));
  }

  _positionAllMarkers() {
    const group = new L.featureGroup(this.#markers);
    this.#map.fitBounds(group.getBounds());
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;
    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
