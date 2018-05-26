let restaurants,
  neighborhoods,
  cuisines,
  loadMapSuccessfully,
  loadRestaurantsSuccessfully
var map
var markers = []

/**
 * Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', (event) => {
  console.log("DOMContentLoaded");
  fetchRestaurants();
});

/**
 * Initialize Google map, called from HTML.
 */
window.finishLoadingMap = () => {
  loadMapSuccessfully = true;
  initMapWithCondition();
  
}

initMapWithCondition = () => {
  if (!loadMapSuccessfully || !loadRestaurantsSuccessfully)
    return;

  let loc = {
    lat: 40.722216,
    lng: -73.987501
  };
  self.map = new google.maps.Map(document.getElementById('map'), {
    zoom: 12,
    center: loc,
    scrollwheel: false
  });
  addMarkersToMap();
}

fetchRestaurants = () => {
  DBHelper.fetchRestaurants((error, restaurants) => {
    if (error) {
      console.error(error);
    } else {
      loadRestaurantsSuccessfully=true;
      fetchNeighborhoods(restaurants);
      fetchCuisines(restaurants);
      updateRestaurants(restaurants);
      initMapWithCondition();
    }
  });



}

/**
 * Fetch all neighborhoods and set their HTML.
 */
fetchNeighborhoods = (restaurants) => {
  const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood)
  // Remove duplicates from neighborhoods
  const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i)
  self.neighborhoods = uniqueNeighborhoods;
  fillNeighborhoodsHTML();

}

/**
 * Set neighborhoods HTML.
 */
fillNeighborhoodsHTML = (neighborhoods = self.neighborhoods) => {
  const select = document.getElementById('neighborhoods-select');
  neighborhoods.forEach(neighborhood => {
    const option = document.createElement('option');
    option.innerHTML = neighborhood;
    option.value = neighborhood;
    select.append(option);
  });
}

/**
 * Fetch all cuisines and set their HTML.
 */
fetchCuisines = (restaurants) => {

  // Get all cuisines from all restaurants
  const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type)
  // Remove duplicates from cuisines
  const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i)
  self.cuisines = uniqueCuisines;

  fillCuisinesHTML();
}

/**
 * Set cuisines HTML.
 */
fillCuisinesHTML = (cuisines = self.cuisines) => {
  const select = document.getElementById('cuisines-select');

  cuisines.forEach(cuisine => {
    const option = document.createElement('option');
    option.innerHTML = cuisine;
    option.value = cuisine;
    select.append(option);
  });
}



/**
 * Update page and map for current restaurants.
 */
updateRestaurants = (restaurants) => {
  const cSelect = document.getElementById('cuisines-select');
  const nSelect = document.getElementById('neighborhoods-select');

  const cIndex = cSelect.selectedIndex;
  const nIndex = nSelect.selectedIndex;

  const cuisine = cSelect[cIndex].value;
  const neighborhood = nSelect[nIndex].value;
  
  let results = restaurants
  
  if (cuisine != 'all') { // filter by cuisine
    results = results.filter(r => r.cuisine_type == cuisine);
  }
  if (neighborhood != 'all') { // filter by neighborhood
    results = results.filter(r => r.neighborhood == neighborhood);
  }

  resetRestaurants(restaurants);
  fillRestaurantsHTML();
}

/**
 * Clear current restaurants, their HTML and remove their map markers.
 */
resetRestaurants = (restaurants) => {
  // Remove all restaurants
  self.restaurants = [];
  const ul = document.getElementById('restaurants-list');
  ul.innerHTML = '';

  // Remove all map markers
  self.markers.forEach(m => m.setMap(null));
  self.markers = [];
  self.restaurants = restaurants;
}

/**
 * Create all restaurants HTML and add them to the webpage.
 */
fillRestaurantsHTML = (restaurants = self.restaurants) => {
  const ul = document.getElementById('restaurants-list');
  restaurants.forEach(restaurant => {
    ul.append(createRestaurantHTML(restaurant));
  });
  
}

/**
 * Create restaurant HTML.
 */
createRestaurantHTML = (restaurant) => {
  const li = document.createElement('li');
  li.setAttribute("role", "listitem");

  // const image = document.createElement('img');
  // image.className = 'restaurant-img lazyload';
  // image.alt = "Image Of " + restaurant.name;
  // image.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  // image.setAttribute('data-src', DBHelper.imageUrlForRestaurant(restaurant));
  // li.append(image);

  const image = document.createElement('img');
	image.className = 'restaurant-img lazyload';
	image.alt = "Image Of " + restaurant.name;
  image.src = DBHelper.imageUrlForRestaurant(restaurant);
  // image.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
	// image.setAttribute('data-src', DBHelper.imageUrlForRestaurant(restaurant));
	// Set srcset for responsive
	const image480 = image.src.replace(/(\.[\w\d_-]+)$/i, '-480$1')
	image.setAttribute('srcset', `${image480} 480w, ${image.src} 800w`);
	image.setAttribute('sizes', '(max-width: 576px) 480px, (max-width: 1200px) 480px');

	li.append(image);


  const name = document.createElement('h2');
  name.innerHTML = restaurant.name;

  li.append(name);

  const neighborhood = document.createElement('p');
  neighborhood.innerHTML = restaurant.neighborhood;
  li.append(neighborhood);

  const address = document.createElement('p');
  address.innerHTML = restaurant.address;
  li.append(address);

  const more = document.createElement('a');
  // more.setAttribute('tabindex', tabIndex.toString());
  more.innerHTML = 'View Details';
  more.href = DBHelper.urlForRestaurant(restaurant);
  li.append(more)

  return li
}


/**
 * Add markers for current restaurants to the map.
 */
addMarkersToMap = (restaurants = self.restaurants) => {
  restaurants.forEach(restaurant => {
    // Add marker to the map
    const marker = DBHelper.mapMarkerForRestaurant(restaurant, self.map);
    google.maps.event.addListener(marker, 'click', () => {
      window.location.href = marker.url
    });
    self.markers.push(marker);
  });
}


window.toggleMap = () => {
  const currentState = document.getElementById('map').style.display;
  document.getElementById('map').style.display = currentState === 'none' ? 'block' : 'none';
}
