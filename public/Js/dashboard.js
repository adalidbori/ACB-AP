let paymentsChart;
let invoicesChart;
document.addEventListener('DOMContentLoaded', () => {
    // 1. Añade los listeners a los encabezados ESTÁTICOS de la tabla una vez.
    showSettingIcon();
    getCardsMetrics();
    initializeCharts(); // Inicializa los gráficos vacíos
    loadPaymentsChartData(); // Carga datos reales para el gráfico de pagos
    loadInvoicesChartData(); // Carga datos reales para el gráfico de facturas

    // Lógica para los iconos de ayuda
    const spendHelpIcon = document.getElementById('spend-help-icon');
    const spendHelpText = document.getElementById('spend-help-text');
    const volumeHelpIcon = document.getElementById('volume-help-icon');
    const volumeHelpText = document.getElementById('volume-help-text');

    spendHelpIcon.addEventListener('click', () => {
        spendHelpText.classList.toggle('hidden');
    });

    volumeHelpIcon.addEventListener('click', () => {
        volumeHelpText.classList.toggle('hidden');
    });
});

async function getCardsMetrics() {
    try {
        const response = await fetch('/dashboard-metrics');

        if (!response.ok) {
            throw new Error(`Error en la solicitud: ${response.statusText}`);
        }

        const metrics = await response.json();

        if (metrics) {
            // Formateador para la moneda en formato americano (USD)
            const currencyFormatter = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
            });

            // Extraer y formatear los valores
            const totalOutstanding = currencyFormatter.format(metrics.TotalOutstanding || 0);
            const pendingInvoices = metrics.PendingInvoices || 0;
            const paidThisMonth = currencyFormatter.format(metrics.PaidThisMonth || 0);
            const overdueInvoices = metrics.OverdueInvoices || 0;

            // Actualizar el HTML con los nuevos valores
            updateCardValue('totalOutstanding', totalOutstanding);
            updateCardValue('pendingInvoices', pendingInvoices);
            updateCardValue('paidThisMonth', paidThisMonth);
            updateCardValue('overdueInvoices', overdueInvoices);
        }

    } catch (error) {
        console.error('Error al cargar las métricas del dashboard:', error);
    }
}

// Función auxiliar para actualizar el texto de una tarjeta
function updateCardValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

// Función para inicializar los gráficos sin datos de ejemplo
function initializeCharts() {
    // Lógica para el gráfico de barras (Pagos por Mes)
    const paymentsCtx = document.getElementById('paymentsChart').getContext('2d');
    paymentsChart = new Chart(paymentsCtx, {
        type: 'bar',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [{
                label: 'Amount Paid ($)',
                data: [], // Inicia vacío
                backgroundColor: 'rgba(90, 103, 216, 0.6)', borderColor: 'rgba(90, 103, 216, 1)',
                borderWidth: 1, borderRadius: 8, barThickness: 20,
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, /* ... */ }
    });

    // Lógica para el gráfico de área (Facturas Procesadas)
    const invoicesCtx = document.getElementById('invoicesChart').getContext('2d');
    const gradient = invoicesCtx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(90, 103, 216, 0.4)');
    gradient.addColorStop(1, 'rgba(90, 103, 216, 0)');

    invoicesChart = new Chart(invoicesCtx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [{
                label: 'Invoices',
                data: [], // Inicia vacío
                fill: true, backgroundColor: gradient, borderColor: '#5A67D8',
                borderWidth: 2, tension: 0.4, pointRadius: 3, pointHoverRadius: 6,
                pointBackgroundColor: '#5A67D8',
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } },
            // ... resto de tus opciones
        }
    });
}

// NUEVA FUNCIÓN para cargar datos del gráfico de pagos
async function loadPaymentsChartData() {
    try {
        const response = await fetch('/monthly-paid-chart');
        if (!response.ok) throw new Error('Error al obtener datos del gráfico de pagos');
        const dataFromApi = await response.json();

        const chartData = Array(12).fill(0);
        dataFromApi.forEach(item => {
            const monthIndex = parseInt(item.PaymentMonth.split('-')[1], 10) - 1;
            chartData[monthIndex] = item.TotalPaid;
        });

        paymentsChart.data.datasets[0].data = chartData;
        paymentsChart.update();
        console.log("Datos del gráfico de pagos actualizados:", chartData);
    } catch (error) {
        console.error("Error al cargar datos para el gráfico de pagos:", error);
    }
}


// FUNCIÓN para cargar y actualizar el gráfico de facturas procesadas
async function loadInvoicesChartData() {
    try {
        const response = await fetch('/invoices-processed-chart');
        if (!response.ok) throw new Error('Error al obtener los datos del gráfico');
        const dataFromApi = await response.json();

        const chartData = Array(12).fill(0);
        dataFromApi.forEach(item => {
            const monthIndex = parseInt(item.PaidMonth.split('-')[1], 10) - 1;
            chartData[monthIndex] = item.NumberOfInvoices;
        });

        invoicesChart.data.datasets[0].data = chartData;
        invoicesChart.update();
        console.log("Datos del gráfico de facturas actualizados:", chartData);
    } catch (error) {
        console.error("Error al cargar datos para el gráfico:", error);
    }
}



function logoutUser() {
    fetch("/logout", {
        method: "POST",
        credentials: "include", // si usas cookies
    })
        .then(res => res.json())
        .then(data => {
            console.log(data);
            // Redirigir si es necesario
            window.location.href = "/login";
        })
        .catch(error => console.error("Error:", error));

}

async function showSettingIcon() {
    try {
        const res = await fetch('/getCurrentUser', {
            method: 'GET',
            credentials: 'include', // Importante para enviar la cookie
        });

        if (!res.ok) throw new Error('Unauthorized');

        const data = await res.json();

        if (data.role === 1) {
            const settingsBtn = document.getElementById('openSettings');
            if (settingsBtn) settingsBtn.style.display = 'inline-block';
        }
    } catch (err) {
        console.error('Error verifying role:', err);
        // Por seguridad, ocultar también si hay error
        const settingsBtn = document.getElementById('openSettings');
        if (settingsBtn) settingsBtn.style.display = 'none';
    }
}

document.getElementById("openSettings").addEventListener("click", function () {
    const targetUrl = "/user-management";
    window.location.href = targetUrl;
});
