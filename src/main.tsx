import { render } from "preact";
import { App } from "./app";
import "./styles.css";
import { initTheme } from "./theme";
initTheme();

const root = document.getElementById("app")!;
// Refuse to run inside another site's frame, so nobody can trick taps (clickjacking).
if (window.top !== window.self) root.innerHTML = '<p style="padding:24px">Open Meron Pa? directly: <a href="." target="_top">open the app</a></p>';
else render(<App />, root);
