import { AbstractView } from "../router";

export class HomePage extends AbstractView {
  render(): HTMLElement {
    const element = document.createElement("div");
    element.classList.add("home-page");

    element.innerHTML = `
            <div class="container">
                <h1>encipherer's whispers!</h1>
                <p>उम्र भर ख्याली भूतों से अगर मैं न डरता
                <br />
                खुदा मैं क्या जोर से जीता
                <br />
                खुदा मैं क्या चैन से मरता
                <br /><br />
                अब हर सांस में सूरज की तपिश भर कर जियूँगा
                <br />
                कतरा-कतरा खौफ बुझाकर
                <br />
                हिम्मत का समंदर पियूँगा</p>
            </div>
        `;

    return element;
  }
}
