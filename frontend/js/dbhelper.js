/**
 * Common database helper functions.
 */
class DBHelper {

  /**
   * Database URL.
   * Change this to restaurants.json file location on your server.
   */
  static get DATABASE_URL() {
    const port = 1337 // Change this to your server port
    return `http://localhost:${port}`;
  }

  /**
   * Fetch all restaurants.
   */
  static fetchRestaurants(callback) {
    fetch(`${DBHelper.DATABASE_URL}/restaurants`).then(response => {
      if (response.status === 200) {
        response.json().then(json => callback(null, json)).catch(error => callback(error, null));
      } else {
        callback(`Request failed. Returned status of ${response.status}`, null);
      }
    }).catch(error => callback(error, null));
  }

  /**
   * Fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id, callback) {
    // fetch all restaurants with proper error handling.
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        const restaurant = restaurants.find(r => r.id == id);
        if (restaurant) { // Got the restaurant
          callback(null, restaurant);
        } else { // Restaurant does not exist in the database
          callback('Restaurant does not exist', null);
        }
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  static fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants  with proper error handling
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given cuisine type
        const results = restaurants.filter(r => r.cuisine_type == cuisine);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   */
  static fetchRestaurantByNeighborhood(neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given neighborhood
        const results = restaurants.filter(r => r.neighborhood == neighborhood);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        let results = restaurants
        if (cuisine != 'all') { // filter by cuisine
          results = results.filter(r => r.cuisine_type == cuisine);
        }
        if (neighborhood != 'all') { // filter by neighborhood
          results = results.filter(r => r.neighborhood == neighborhood);
        }
        callback(null, results);
      }
    });
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  static fetchNeighborhoods(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all neighborhoods from all restaurants
        const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood)
        // Remove duplicates from neighborhoods
        const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i)
        callback(null, uniqueNeighborhoods);
      }
    });
  }

  /**
   * Fetch all cuisines with proper error handling.
   */
  static fetchCuisines(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all cuisines from all restaurants
        const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type)
        // Remove duplicates from cuisines
        const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i)
        callback(null, uniqueCuisines);
      }
    });
  }

  /**
   * Restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return (`./restaurant.html?id=${restaurant.id}`);
  }

  /**
   * Restaurant image URL.
   */
  static imageUrlForRestaurant(restaurant) {
    return `img/${restaurant.id}.jpg`;
  }

  static srcsetUrlSmallForRestaurant(restaurant) {
    return `/responsive-images/${
      restaurant.id
      }-320_small_2x.jpg 2x, /responsive-images/${
      restaurant.id
      }-160_small_1x.jpg 1x`;
  }

  static srcsetUrlMediumForRestaurant(restaurant) {
    return `/responsive-images/${
      restaurant.id
      }-640_medium_2x.jpg 2x, /responsive-images/${
      restaurant.id
      }-320_medium_1x.jpg 1x`;
  }

  static imageAltForRestaurants(restaurant) {
    return `Restaurant ${restaurant.name} in ${restaurant.neighborhood}`;
  }

  /**
   * Map marker for a restaurant.
   */
  static mapMarkerForRestaurant(restaurant, map) {
    const marker = new google.maps.Marker({
      position: restaurant.latlng,
      title: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant),
      map: map,
      animation: google.maps.Animation.DROP
    }
    );
    return marker;
  }

  static submitReview(data, callback) {
    console.log(data);

    return fetch(`${DBHelper.DATABASE_URL}/reviews`, {
      body: JSON.stringify(data),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      method: 'POST',
    })
      .then(response => {
        response.json()
          .then(data => {
            dbPromise().then(db => {
              const tx = db.transaction('reviews', 'readwrite');
              const store = tx.objectStore('reviews');
              store.put(data);
            });
            return data;
          })
          callback(null)
      })
      .catch(error => {
        data['updatedAt'] = new Date().getTime();
        data['createdAt'] = new Date().getTime();
        console.log(data);

        dbPromise().then(db => {
          const tx = db.transaction('reviewoutbox', 'readwrite');
          const store = tx.objectStore('reviewoutbox');
          store.put(data);
          console.log('Review stored offline in IDB');
          callback(error)
        });
      });
  }


  static toggleFavorite(restaurant, isFavorite, callback) {
    restaurant.is_favorite = isFavorite
    return fetch(`${DBHelper.DATABASE_URL}/restaurants/${restaurant.id}/?is_favorite=${isFavorite}`, {
      method: 'PUT'
    })
      .then(response => {
        return response.json();
      })
      .then(data => {
        dbPromise().then(db => {
          if (!db) return;
          const tx = db.transaction('restaurants', 'readwrite');
          const store = tx.objectStore('restaurants');
          store.put(data)
        });
        callback(null);
        return data;
      })
      .catch(error => {
        dbPromise().then(db => {
          const tx = db.transaction('restaurants', 'readwrite');
          const store = tx.objectStore('restaurants');
          store.put(restaurant);

          const favoritetx = db.transaction('favoriteoutbox', 'readwrite');
          const favoritestore = favoritetx.objectStore('favoriteoutbox');
          favoritestore.put(restaurant);

          callback(error);
        }).catch(error => {
          console.log(error);
        });
      });
  }

  
  static fetchReviewsForRestaurant(id, callback) {
    dbPromise().then(db => {
			if (!db) return;
			// 1. Check if there are reviews in the IDB
			const tx = db.transaction('reviews');
			const index = tx.objectStore('reviews').index('restaurant_id');
			index.getAll(id).then(results => {
				if (results && results.length > 0) {
					// Continue with reviews from IDB
					callback(null, results);
				} else {
					// 2. If there are no reviews in the IDB, fetch reviews from the network
					fetch(`${DBHelper.DATABASE_URL}/reviews/?restaurant_id=${id}`)
					.then(response => {
						return response.json();
					})
					.then(reviews => {
						dbPromise().then(db => {
							if (!db) return;
							// 3. Put fetched reviews into IDB
							const tx = db.transaction('reviews', 'readwrite');
							const store = tx.objectStore('reviews');
							reviews.forEach(review => {
								store.put(review);
							})
						});
						// Continue with reviews from network
						callback(null, reviews);
					})
					.catch(error => {
						// Unable to fetch reviews from network
						callback(error, null);
					})
				}
			})
		});
  }
}
