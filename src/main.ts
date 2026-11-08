import { mount } from 'svelte';
import { lang } from './i18n/index.svelte';
import App from './ui/App.svelte';
import './ui/app.css';

document.documentElement.lang = lang();

const target = document.getElementById('app');
if (target) mount(App, { target });
