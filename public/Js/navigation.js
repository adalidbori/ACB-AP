// Mapea cada tab con su URL destino
const tabUrls = {
    "in-progress": "/",
    "waiting-pproval": "/waiting-approval",
    "ready-to-pay": "/ready-to-pay",
    "paid": "/paid"
};

// Escucha los clics en cada tab y redirige
document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
        const tabKey = tab.getAttribute("data-tab");
        const targetUrl = tabUrls[tabKey];
        if (targetUrl) {
            window.location.href = targetUrl;
        }
    });
});
