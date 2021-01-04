if (!sessionStorage.getItem('theme')) {
    let theme = "light"
    sessionStorage.setItem('theme', theme);
}

function onThemeSwitch() {
    let theme = getTheme();
    theme = (theme === "light") ? "dark" : "light";
    setTheme(theme);
    initTheme();
};

function getTheme() {
    return (sessionStorage.getItem('theme')) ? sessionStorage.getItem('theme') : null;
}

function setTheme(theme) {
    sessionStorage.setItem('theme', theme);
    return theme;
}

function initTheme() {
    let theme = getTheme();
    document.documentElement.style.setProperty("--theme-color", (theme === "light") ? "#E5E7EB" : "#101010");
    document.documentElement.style.setProperty("--complimentary-color", (theme === "light") ? "black" : "white");
    document.documentElement.style.setProperty("--background-color", (theme === "light") ? "#9CA3AF" : "#A9A9A9");
    return setTheme(theme);
}

function initToggleBox(theme) {
    document.getElementById("theme-selector").checked = (theme === "light") ? false : true;
}

document.addEventListener('DOMContentLoaded', function () {
    let theme = initTheme();
    initToggleBox(theme);
}, false);

window.addEventListener('load', function () {
    setTimeout(() => {
        document.getElementById("blog-content").style.visibility = "visible";
    }, 100);
});