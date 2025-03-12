import React from 'react';
import ReactDOM from 'react-dom/client';
import App from "./App";
import { ProxyProgressNotification } from "./components/proxy-progress-notification";
import "./index.css";
const AppWithNotifications = () => (
  <>
    <App />
    <ProxyProgressNotification />
  </>
);
const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(<AppWithNotifications />);