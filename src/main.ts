import { mount } from 'svelte';
import { lang } from './i18n/index.svelte';
import App from './ui/App.svelte';
import { apply as applyAppearance } from './ui/appearance.svelte';
import { keepAlive } from './ui/heartbeat';
import './ui/app.css';

document.documentElement.lang = lang();
applyAppearance();

const target = document.getElementById('app');
if (target) mount(App, { target });
keepAlive();
