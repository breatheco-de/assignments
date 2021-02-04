//import react into the bundle
import React from "react";
import ReactDOM from "react-dom";

//include your index.scss file into the bundle
import "../styles/index.scss";

//import your own components
import { Home } from "./home.js";

//render your react applicationn
ReactDOM.render(<Home />, document.querySelector("#app"));
