import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource-variable/nunito/wght.css';
import './styles/app.css';
import { mount } from 'svelte';
import App from './App.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('Élément #app introuvable');

// Limite le risque que le navigateur efface la sauvegarde.
void navigator.storage?.persist?.();

mount(App, { target });
