import { Observable } from "rxjs/Observable";
import "rxjs/add/operator/mergeMap";
import "rxjs/add/operator/map";
import "rxjs/add/operator/catch";
import "rxjs/add/operator/take";
import "rxjs/add/observable/concat";
import "rxjs/add/observable/of";
import "rxjs/add/observable/fromPromise";
import "rxjs/add/observable/merge";
import "rxjs/add/observable/dom/ajax";

import { cbAPI, nomiAPI } from "../utils/APIs";
import db from "../cache/db";
import { dbWorker } from "../../../workers";

export const LOADING = "LOADING";

export const APP_BOOTSTRAP = "APP_START";
export const NETWORKS_LOADED = "NETWORKS_LOADED";

export const LOCATION_LOADED = "LOCATION_LOADED";
export const LOCATION_UPDATED = "LOCATION_UPDATED";

export const PLACE_LOADED = "PLACE_LOADED";
export const SEARCH_LOCK = "SEARCH_LOCK";

export const PERSISTENT_STORAGE = "PERSISTENT_STORAGE";

export const loading = (show = true) => ({ type: LOADING, payload: show });

export const appBootstrap = () => ({ type: APP_BOOTSTRAP });
export const networksLoaded = payload => ({ type: NETWORKS_LOADED, payload });

export const locationLoaded = payload => ({ type: LOCATION_LOADED, payload });
export const locationUpdated = payload => ({ type: LOCATION_UPDATED, payload });

export const placeLoaded = payload => ({ type: PLACE_LOADED, payload });

export const searchLock = (lock = true) => ({
  type: SEARCH_LOCK,
  payload: lock
});

export const setPersistentStorage = (enabled = false) => ({
  type: PERSISTENT_STORAGE,
  payload: enabled
});

const locationWatcher$ = Observable.create(observer => {
  if ("geolocation" in navigator) {
    navigator.geolocation.watchPosition(
      position => observer.next(position),
      error => observer.error(error)
    );
  } else {
    observer.error({ message: "Geolocation API not available" });
  }
});

export const loadLocationEpic = action$ =>
  Observable.concat(
    Observable.of(searchLock(true)),
    action$.ofType(APP_BOOTSTRAP).mergeMap(action =>
      locationWatcher$
        .take(1)
        .mergeMap(({ coords: { latitude, longitude } }) =>
          Observable.of(locationLoaded({ latitude, longitude }))
        )
        .catch(err => {
          console.warn(err);
          return Observable.of(searchLock(false));
        })
    )
  );

export const updateLocationEpic = action$ =>
  action$
    .ofType(LOCATION_LOADED)
    .mergeMap(() =>
      locationWatcher$.mergeMap(({ coords: { latitude, longitude } }) =>
        Observable.of(locationUpdated({ latitude, longitude }))
      )
    )
    .catch(err => {
      console.warn(err);
      return Observable.empty();
    });

export const loadPlaceEpic = action$ =>
  action$.ofType(LOCATION_LOADED).mergeMap(({ payload }) =>
    Observable.ajax({
      url: nomiAPI(
        `reverse?format=json&lat=${payload.latitude}&lon=${payload.longitude}`
      ),
      method: "GET",
      responseType: "json",
      crossDomain: true,
      headers: {
        "Accept-Language": "en-US"
      }
    })
      .map(({ response, status }) => {
        if (status <= 400) {
          return placeLoaded(response);
        } else {
          console.warn(
            `Couldn't load reversal geo location: Error ${status} - ${response}`
          );
          return searchLock(false);
        }
      })
      .catch(err => Observable.of(searchLock(false)))
  );

export const loadNetworksEpic = action$ =>
  action$.ofType(APP_BOOTSTRAP).mergeMap(action =>
    Observable.merge(
      Observable.of(loading(true)),
      Observable.ajax({
        url: cbAPI`networks`,
        method: "GET",
        responseType: "json",
        crossDomain: true
      })
        .map(({ response, status }) => {
          if (status <= 400) {
            const action = networksLoaded(response.networks);
            dbWorker.postMessage(action);
            return action;
          }
        })
        .catch(err =>
          Observable.fromPromise(
            db.networks.toArray().then(networks => networksLoaded(networks))
          )
        )
        .mergeMap(resolvingAction =>
          Observable.merge(
            Observable.of(resolvingAction),
            Observable.of(loading(false))
          )
        )
    )
  );

export const setPersistentStorageEpic = action$ =>
  action$.ofType(APP_BOOTSTRAP).mergeMap(action => {
    if (navigator.storage && navigator.storage.persist)
      return Observable.fromPromise(
        navigator.storage.persist().then(setPersistentStorage)
      );
  });
