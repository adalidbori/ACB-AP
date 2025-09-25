let paymentsChart;
let invoicesChart;
let topVendorsChartInstance = null;
document.addEventListener('DOMContentLoaded', () => {
    // 1. Añade los listeners a los encabezados ESTÁTICOS de la tabla una vez.
    showSettingIcon();
    getCardsMetrics();
    initializeCharts(); // Inicializa los gráficos vacíos
    loadPaymentsChartData(); // Carga datos reales para el gráfico de pagos
    loadInvoicesChartData(); // Carga datos reales para el gráfico de facturas
    loadProcessingChart();
    loadTopVendorsChart();

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
                backgroundColor: 'rgba(90, 103, 216, 0.6)',
                borderColor: 'rgba(90, 103, 216, 1)',
                borderWidth: 1,
                borderRadius: 8,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { // <-- AÑADE ESTO
                legend: {
                    display: false // Esto oculta la leyenda "Amount Paid ($)"
                }
            }
        }
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
                fill: true,
                backgroundColor: gradient,
                borderColor: '#5A67D8',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 3,
                pointHoverRadius: 6,
                pointBackgroundColor: '#5A67D8',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            plugins: { // <-- AÑADE ESTO
                legend: {
                    display: false // Esto oculta la leyenda "Invoices"
                }
            }
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


// --- Variables para gestionar el estado del gráfico y guardar datos ---
let isDrillDownView = false;
let originalChartData = {}; // Para guardar los datos originales de los meses

// --- Función para cargar los datos de detalle (Drill-Down) ---
async function loadDrillDownData(monthKey) {
    try {
        // Hacemos la llamada al nuevo endpoint del backend
        const response = await fetch(`/processing-stages-chart?month=${monthKey}`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error al obtener datos detallados: ${errorText}`);
        }
        const stageDataFromApi = await response.json();

        // Nombres de las etapas en el orden esperado
        const STAGE_LABELS = ['In Progress', 'Waiting Approval', 'Ready to pay'];
        const chartDataForStages = Array(4).fill(null);

        // Mapeamos los datos recibidos al array que usará el gráfico
        stageDataFromApi.forEach(item => {
            const index = STAGE_LABELS.indexOf(item.invoiceStatusName);
            if (index !== -1) {
                // El backend ya devuelve el valor en días, así que lo usamos directamente
                chartDataForStages[index] = item.AverageTimeInDays;
            }
        });

        const chart = window.processingChartInstance;
        const monthIndex = parseInt(monthKey.split('-')[1], 10) - 1;
        const monthLabel = originalChartData.labels[monthIndex];

        // Actualizamos el gráfico con los nuevos datos de las etapas
        chart.data.labels = STAGE_LABELS;
        chart.data.datasets[0].data = chartDataForStages;
        chart.data.datasets[0].label = `Días promedio para ${monthLabel}`;
        chart.update();

        // Actualizamos la UI para mostrar que estamos en la vista de detalle
        isDrillDownView = true;
        document.getElementById('chart-title').innerText = `Stage Details for ${monthLabel}`;
        document.getElementById('back-to-overview-btn').classList.remove('hidden');

    } catch (error) {
        console.error("Error en la función loadDrillDownData:", error);
        alert("No se pudieron cargar los datos detallados para este mes.");
    }
}

// --- Tu función modificada ---
async function loadProcessingChart() {
    try {
        const response = await fetch('/avg-processing-chart');
        if (!response.ok) throw new Error('Error al obtener datos del promedio');
        const dataFromApi = await response.json();

        const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const chartData = Array(12).fill(null);

        dataFromApi.forEach(item => {
            const monthIndex = parseInt(item.PaidMonth.split('-')[1], 10) - 1;
            chartData[monthIndex] = item.AvgProcessingDays;
        });

        // Guardamos los datos originales para poder volver a esta vista
        originalChartData = {
            labels: labels,
            data: chartData,
            label: 'Average processing days'
        };

        const ctx = document.getElementById('processingChart').getContext('2d');
        if (window.processingChartInstance) {
            window.processingChartInstance.destroy();
        }

        window.processingChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: originalChartData.labels,
                datasets: [{
                    label: originalChartData.label,
                    data: originalChartData.data,
                    backgroundColor: 'rgba(99, 102, 241, 0.6)',
                    borderColor: 'rgba(99, 102, 241, 1)',
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (evt, elements) => {
                    if (elements.length > 0 && !isDrillDownView) {
                        const index = elements[0].index;
                        const year = new Date().getFullYear(); // Asumimos el año actual
                        const monthKey = `${year}-${String(index + 1).padStart(2, '0')}`;

                        // Llamamos a la función que busca los datos del detalle
                        loadDrillDownData(monthKey);
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                // Obtener el valor numérico, o 0 si no existe
                                const value = context.raw || 0;

                                // Comprobar si estamos en la vista de detalle
                                if (isDrillDownView) {
                                    // Si es la vista de detalle, mostrar con dos decimales
                                    return `${value.toFixed(2)} days`;
                                } else {
                                    // Si es la vista general, redondear al número entero más cercano
                                    return `${Math.round(value)} days`;
                                }
                            }
                        }
                    },
                    legend: { display: false }
                },
                scales: {
                    y: {},
                    x: {}
                }
            }
        });
    } catch (error) {
        console.error("Error cargando gráfico de promedio:", error);
    }
}

// --- Lógica para el botón de "Volver" en la grafica de Avg Processing Time---
document.getElementById('back-to-overview-btn').addEventListener('click', () => {
    // Si no estamos en la vista de detalle, no hacer nada
    if (!isDrillDownView) return;

    const chart = window.processingChartInstance;

    // Restauramos el gráfico con los datos originales que guardamos
    chart.data.labels = originalChartData.labels;
    chart.data.datasets[0].data = originalChartData.data;
    chart.data.datasets[0].label = originalChartData.label;
    chart.update();

    // Restauramos el estado y la UI
    isDrillDownView = false;
    document.getElementById('chart-title').innerText = 'Avg Processing Time';
    document.getElementById('back-to-overview-btn').classList.add('hidden');
});


async function loadTopVendorsChart() {
    try {
        const response = await fetch('/top-vendors-chart'); // Llama a tu nuevo endpoint
        if (!response.ok) {
            throw new Error('Error al obtener los datos de los proveedores');
        }
        const dataFromApi = await response.json();

        // 1. Procesa los datos para que Chart.js los entienda
        const vendorLabels = dataFromApi.map(item => item.vendor);
        const vendorData = dataFromApi.map(item => item.TotalSpend);

        const ctx = document.getElementById('topVendorsChart').getContext('2d');

        // 2. IMPORTANTE: Destruye el gráfico anterior si ya existe
        // Esto evita el error "Canvas is already in use" si recargas los datos.
        if (topVendorsChartInstance) {
            topVendorsChartInstance.destroy();
        }

        // 3. Crea el nuevo gráfico con los datos reales
        topVendorsChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: vendorLabels,
                datasets: [{
                    label: 'Spend',
                    data: vendorData,
                    backgroundColor: [
                        'rgba(99, 102, 241, 0.8)', 'rgba(59, 130, 246, 0.8)',
                        'rgba(34, 197, 94, 0.8)', 'rgba(234, 179, 8, 0.8)',
                        'rgba(239, 68, 68, 0.8)'
                    ],
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { boxWidth: 20, padding: 20 }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.label || '';
                                if (label) { label += ': '; }
                                const formatter = new Intl.NumberFormat('en-US', {
                                    style: 'currency', currency: 'USD', minimumFractionDigits: 0
                                });
                                label += formatter.format(context.parsed);
                                return label;
                            }
                        }
                    }
                }
            }
        });

    } catch (error) {
        console.error("Error al cargar el gráfico de proveedores:", error);
    }
}



document.getElementById("openSettings").addEventListener("click", function () {
    const targetUrl = "/user-management";
    window.location.href = targetUrl;
});





