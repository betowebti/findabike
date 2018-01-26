import React from 'react';
import { render } from "react-dom";
import { Provider } from "react-redux";
import { BrowserRouter as Router } from 'react-router-dom';
import runtime from 'serviceworker-webpack-plugin/lib/runtime';

import store from "./store";
import "./app.scss";
import Home from "./modules/home/containers/Home";
import { appBootstrap } from "./modules/commons/epics";

import Modal from "./modules/commons/containers/Modal";
import LoadingBar from "./modules/commons/containers/LoadingBar";

if ('serviceWorker' in navigator) {
  runtime.register();
}

document.addEventListener('DOMContentLoaded', () => store.dispatch(appBootstrap()), false);

const App = () =>
  <Router>
    <main id="react-app" className="container is-fluid">
      <LoadingBar/>
      <Modal/>
      <div className="section">
        <Home/>
        <footer>
          <div className="box is-small">
            <span>Powered by:</span>
            <div className='credits-box'>
              <a href="https://www.openstreetmap.org" target='_blank' rel="noopener">Open Street Map</a>&
              <a href="https://api.citybik.es/v2/" target='_blank' rel="noopener">CityBikes</a>&
              <a href="https://surge.sh/" target='_blank' rel="noopener">Surge</a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  </Router>;

render(
  <Provider store={store}>
    <App/>
  </Provider>,
  document.getElementById("app")
);