import { AbstractView } from '../router';

export class HomePage extends AbstractView {
    render(): HTMLElement {
        const element = document.createElement('div');
        element.classList.add('home-page');

        element.innerHTML = `
            <div class="container">
                <h1>Welcome</h1>
                <p>A minimalist blog built with TypeScript.</p>
            </div>
        `;

        return element;
    }
}