let restaurant;
let reviews;
var map;

/**
 * Initialize Google map, called from HTML.
 */
window.initMap = () => {
  fetchRestaurantFromURL((error, restaurant) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      self.map = new google.maps.Map(document.getElementById('map'), {
        zoom: 16,
        center: restaurant.latlng,
        scrollwheel: false
      });
      fillBreadcrumb();
      DBHelper.mapMarkerForRestaurant(self.restaurant, self.map);
    }
  });
}

/**
 * Get current restaurant from page URL.
 */
fetchRestaurantFromURL = (callback) => {
  if (self.restaurant) { // restaurant already fetched!
    callback(null, self.restaurant)
    return;
  }
  const id = getParameterByName('id');
  if (!id) { // no id found in URL
    error = 'No restaurant id in URL'
    callback(error, null);
  } else {
    DBHelper.fetchRestaurantById(id, (error, restaurant) => {
      self.restaurant = restaurant;
      if (!restaurant) {
        console.error(error);
        return;
      }
      fillRestaurantHTML();
      callback(null, restaurant)
    });
  }
}

/*
 * fetch reviews
 */
fetchReviews = () => {
  const id = parseInt(getParameterByName('id'));
  if (!id) {
    console.log('No restaurant id in URL to fetchReviews');
    return;
  }
  DBHelper.fetchReviewsForRestaurant(id, (err, reviews) => {
    self.reviews = reviews;
    if (err || !reviews) {
      console.log('reviews fetch error', err);
      return;
    }
    fillReviewsHTML();
  });
}

/*
 * set favorite button
 */
setFavoriteButton = (status) => {
  const favCheck = document.getElementById('favCheck');
  favCheck.innerHTML = (status === 'true' ? 'Favourite' : 'Not Favourite');
}

/**
 * Create restaurant HTML and add it to the webpage
 */
fillRestaurantHTML = (restaurant = self.restaurant) => {
  const name = document.getElementById('restaurant-name');
  name.innerHTML = restaurant.name;
  setFavoriteButton(restaurant.is_favorite);

  const address = document.getElementById('restaurant-address');
  address.innerHTML = restaurant.address;

  // const image = document.getElementById('restaurant-img');
  // image.className = 'restaurant-img lazyload';
  // image.alt = 'Photo of ' + restaurant.name;
  // image.setAttribute('data-src', DBHelper.imageUrlForRestaurant(restaurant));
  // image.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

  const image = document.getElementById('restaurant-img');
  image.className = 'restaurant-img lazyload';
  image.alt = 'Photo of ' + restaurant.name;
  image.src = DBHelper.imageUrlForRestaurant(restaurant);

  // Set srcset for responsive
  const image480 = image.src.replace(/(\.[\w\d_-]+)$/i, '-480$1')
  image.setAttribute('srcset', `${image480} 480w, ${image.src} 800w`);

  const cuisine = document.getElementById('restaurant-cuisine');
  cuisine.innerHTML = restaurant.cuisine_type;

  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  }
  fetchReviews();
}

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
fillRestaurantHoursHTML = (operatingHours = self.restaurant.operating_hours) => {
  const hours = document.getElementById('restaurant-hours');
  for (let key in operatingHours) {
    const row = document.createElement('tr');

    const day = document.createElement('td');
    day.innerHTML = key;
    row.appendChild(day);

    const time = document.createElement('td');
    time.innerHTML = operatingHours[key];
    row.appendChild(time);

    hours.appendChild(row);
  }
}

/**
 * Create all reviews HTML and add them to the webpage.
 */
fillReviewsHTML = (reviews = self.reviews) => {
  const container = document.getElementById('reviews-container');
  const title = document.createElement('h3');
  title.innerHTML = 'Reviews';
  title.setAttribute('tabindex', 0);
  container.appendChild(title);

  if (!reviews) {
    const noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews found!';
    noReviews.setAttribute('tabindex', 0);
    container.appendChild(noReviews);
    return;
  }
  const ul = document.getElementById('reviews-list');
  reviews.forEach(review => {
    ul.appendChild(createReviewHTML(review));
  });
  container.appendChild(ul);
}

/**
 * Create review HTML and add it to the webpage.
 */
createReviewHTML = (review) => {
  const li = document.createElement('li');
  li.setAttribute('role', 'listitem');
  const name = document.createElement('p');
  name.innerHTML = review.name;
  name.setAttribute('tabindex', 0);
  li.appendChild(name);

  const date = document.createElement('p');
  date.innerHTML = formatDate(review.updatedAt);
  li.appendChild(date);

  const rating = document.createElement('p');
  rating.innerHTML = `Rating: ${review.rating}`;
  rating.setAttribute('tabindex', 0);
  li.appendChild(rating);

  const comments = document.createElement('p');
  comments.innerHTML = review.comments;
  comments.setAttribute('tabindex', 0);
  li.appendChild(comments);

  return li;
}

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
fillBreadcrumb = (restaurant = self.restaurant) => {
  const breadcrumb = document.getElementById('breadcrumb');
  const li = document.createElement('li');
  li.innerHTML = restaurant.name;
  li.setAttribute('aria-current', 'page');
  breadcrumb.appendChild(li);
}

/**
 * Get a parameter by name from page URL.
 */
getParameterByName = (name, url) => {
  if (!url)
    url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
    results = regex.exec(url);
  if (!results)
    return null;
  if (!results[2])
    return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}


formatDate = (ts) => {
  let date = new Date(ts);
  return date.getDate() + '/' + (date.getMonth() + 1) + '/' + date.getFullYear();
}

navigator.serviceWorker.ready.then(function (swRegistration) {
  let form = document.querySelector('#review-form');
  form.addEventListener('submit', e => {
    e.preventDefault();
    let rating = form.querySelector('#rating');
    let review = {
      restaurant_id: parseInt(getParameterByName('id')),
      name: form.querySelector('#name').value,
      rating: rating.options[rating.selectedIndex].value,
      comments: form.querySelector('#comment').value
    };
    DBHelper.submitReview(review, (error) => {
      if (error) {
        console.log('swRegistration.sync.register');
        return swRegistration.sync.register('myFirstSync').then(() => {
          console.log('Sync registered');
        });
      }
    }).then((data) => {
      const ul = document.getElementById('reviews-list');
      review.createdAt = new Date();
      review.updatedAt = new Date();
      ul.appendChild(createReviewHTML(review));
      form.reset();
    }).catch(error => {
      console.log(error);
      console.log('swRegistration.sync.register');
      return swRegistration.sync.register('myFirstSync').then(() => {
        console.log('Sync registered');
      });
    }
    );
  });
});

navigator.serviceWorker.ready.then(function (swRegistration) {
  let favCheck = document.getElementById('favCheck');
  favCheck.addEventListener('click', event => {

    const opposite = (self.restaurant.is_favorite === 'true') ? 'false' : 'true';

    DBHelper.toggleFavorite(self.restaurant, opposite, (error) => {
      if (error) {
        console.log('swRegistration.sync.register');
        return swRegistration.sync.register('myFirstSync').then(() => {
          console.log('Sync registered');
        });
      }
    }).then(() => {
      setFavoriteButton(opposite);
    }).catch(error => {
      console.log(error);

    }
    );

  });
});
