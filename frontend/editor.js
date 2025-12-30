const canvasContainer = document.getElementById('canvas-container');
const canvasScaler = document.getElementById('canvas-scaler');
const canvas = document.getElementById('canvas');
const connectionsLayer = document.getElementById('connections-layer');
const minimap = document.getElementById('minimap');

// State
let scale = 1;
const SCALE_STEP = 0.1;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.0;

let isDraggingCanvas = false;
let startX, startY;
let canvasX = -2000;
let canvasY = -2000;

let nodes = [];
let connections = [];
let draggingNodeId = null;
let dragParams = { startX: 0, startY: 0, initialNodeX: 0, initialNodeY: 0 };

let tempConnectionLine = null;
let linkingFrom = null; // { nodeId, portIndex }

let nextId = 1;

// --- Initialization ---

// --- Initialization ---

async function checkAuth() {
    try {
        const res = await fetch('http://127.0.0.1:8000/api/v2/me/');
        if (res.ok) {
            const data = await res.json();
            if (!data.is_authenticated) {
                // Not logged in -> Redirect to Landing
                window.location.href = 'index.html';
                return false;
            }
            return true;
        }
    } catch (e) {
        console.error("Auth check failed", e);
    }
    return false;
}

async function init() {
    const isAuth = await checkAuth();
    if (!isAuth) return; // Stop if redirecting

    updateTransform();
    setupEventListeners();
    setupZoomControls();
    loadCanvas();
}

// --- Coordinate Utilities ---

// Converts Screen Coordinates (Mouse ClientX/Y) to Canvas Coordinates (taking Pan and Zoom into account)
function getCanvasCoords(clientX, clientY) {
    // 1. Get Mouse relative to Container
    const rect = canvasContainer.getBoundingClientRect();
    const xRel = clientX - rect.left;
    const yRel = clientY - rect.top;

    // 2. Adjust for Zoom (Scale)
    // The scaler scales from 0,0. So we divide by scale.
    const xScaled = xRel / scale;
    const yScaled = yRel / scale;

    // 3. Adjust for Pan (Canvas X/Y inside the Scaler)
    // Canvas is positioned at (canvasX, canvasY)
    // So Point on Canvas = ScaledPoint - CanvasPosition
    return {
        x: xScaled - canvasX,
        y: yScaled - canvasY
    };
}

// --- Zoom & Pan ---

function updateTransform() {
    canvasScaler.style.transform = `scale(${scale})`;
    canvas.style.left = canvasX + 'px';
    canvas.style.top = canvasY + 'px';
    document.getElementById('zoom-level').innerText = Math.round(scale * 100) + '%';
    renderMinimap();
}

function zoom(delta) {
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale + delta));

    // Optional: Zoom towards center of viewport (advanced), for now just center zoom
    // To keep it simple, we just update scale property
    scale = newScale;
    updateTransform();
    updateConnections(); // Lines usually scale fine via SVG, but recalculating positions is safer
}

function setupZoomControls() {
    document.getElementById('zoom-in').onclick = () => zoom(SCALE_STEP);
    document.getElementById('zoom-out').onclick = () => zoom(-SCALE_STEP);
    document.getElementById('zoom-reset').onclick = () => { scale = 1; updateTransform(); };

    // Left Sidebar
    document.getElementById('toggle-sidebar-btn').onclick = () => {
        document.getElementById('left-sidebar').classList.toggle('collapsed');
    };

    // Right Sidebar
    const rightSidebarBtn = document.getElementById('toggle-right-sidebar-btn');
    if (rightSidebarBtn) {
        rightSidebarBtn.onclick = () => {
            document.getElementById('right-sidebar').classList.toggle('collapsed');
        };
    }

    // Save & Clear
    document.getElementById('save-btn').onclick = saveCanvas;
    document.getElementById('clear-btn').onclick = clearCanvas;

    // Mouse Wheel Zoom
    canvasContainer.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            zoom(e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP);
        }
    });
}

function setupEventListeners() {
    // Pan Canvas
    canvasContainer.addEventListener('mousedown', (e) => {
        if (e.target === canvasContainer || e.target === canvas || e.target.id === 'connections-layer') {
            isDraggingCanvas = true;
            startX = e.clientX;
            startY = e.clientY;
            canvasContainer.style.cursor = 'grabbing';
        }
    });

    window.addEventListener('mouseup', () => {
        isDraggingCanvas = false;
        draggingNodeId = null;
        canvasContainer.style.cursor = '';
        if (linkingFrom) stopLinking();
    });

    window.addEventListener('mousemove', (e) => {
        if (isDraggingCanvas) {
            const dx = (e.clientX - startX) / scale; // Adjust pan speed for zoom
            const dy = (e.clientY - startY) / scale;

            canvasX += dx;
            canvasY += dy;

            startX = e.clientX;
            startY = e.clientY;

            updateTransform();
        }

        if (draggingNodeId) {
            // Dragging a node
            // Calculate delta in screen pixels
            const dx = (e.clientX - dragParams.startX) / scale;
            const dy = (e.clientY - dragParams.startY) / scale;

            updateNodePosition(draggingNodeId, dragParams.initialNodeX + dx, dragParams.initialNodeY + dy);
        }

        if (linkingFrom) {
            updateTempLine(e.clientX, e.clientY);
        }
    });

    // Drop from Sidebar
    canvasContainer.addEventListener('dragover', (e) => e.preventDefault());
    canvasContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('type');
        if (type) {
            const pos = getCanvasCoords(e.clientX, e.clientY);
            // Center the new node roughly
            createNode(type, pos.x - 100, pos.y - 20);
        }
    });

    // Sidebar Draggables
    document.querySelectorAll('.node-template').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('type', item.dataset.type);
        });
    });
}

// --- Nodes ---

function createNode(type, x, y) {
    const id = nextId++;
    const nodeData = {
        id, type, x, y,
        title: type.charAt(0).toUpperCase() + type.slice(1),
        outputs: type === 'condition' ? ['Yes', 'No'] : (type === 'end' ? [] : ['Next']),
        inputs: type !== 'start',
        data: {}
    };
    nodes.push(nodeData);
    renderNode(nodeData);
    renderMinimap();
}

function renderNode(nodeData) {
    const el = document.createElement('div');
    el.className = 'node';
    el.id = `node-${nodeData.id}`;
    el.style.left = nodeData.x + 'px';
    el.style.top = nodeData.y + 'px';

    // Header with Drag logic
    const header = document.createElement('div');
    header.className = 'node-header';
    header.innerHTML = `<span>${nodeData.title}</span> <span style="cursor:pointer; color:#ef4444;" onclick="deleteNode(${nodeData.id})">×</span>`;

    header.onmousedown = (e) => {
        e.stopPropagation();
        draggingNodeId = nodeData.id;
        dragParams.startX = e.clientX;
        dragParams.startY = e.clientY;
        dragParams.initialNodeX = nodeData.x;
        dragParams.initialNodeY = nodeData.y;
    };
    el.appendChild(header);

    // Input Port
    if (nodeData.inputs) {
        const inputPort = document.createElement('div');
        inputPort.className = 'node-input';
        // Allow dropping connection here
        inputPort.onmouseup = (e) => finishLinking(nodeData.id, e);
        el.appendChild(inputPort);
    }

    // Content
    const content = document.createElement('div');
    content.className = 'node-content';
    if (nodeData.type === 'instruction') {
        const textarea = document.createElement('textarea');
        textarea.className = 'node-text-area';
        textarea.placeholder = "Enter instructions...";
        textarea.value = nodeData.data?.text || '';
        textarea.oninput = (e) => {
            if (!nodeData.data) nodeData.data = {};
            nodeData.data.text = e.target.value;
        };
        content.appendChild(textarea);
    } else if (nodeData.type === 'condition') {
        content.innerHTML = `<button class="btn-option" style="padding:5px; font-size:0.8rem;" onclick="addOption(${nodeData.id})">+ Option</button>`;
    } else {
        content.innerHTML = `<p style="margin:0; font-size:0.8rem; color:#94a3b8;">${nodeData.type} node</p>`;
    }
    el.appendChild(content);

    // Outputs
    const outputsContainer = document.createElement('div');
    outputsContainer.className = 'outputs-container';
    el.appendChild(outputsContainer);
    renderOutputs(nodeData, outputsContainer);

    canvas.appendChild(el);
    setTimeout(updateConnections, 0); // Update lines after render
}

function renderOutputs(nodeData, container) {
    container.innerHTML = '';
    nodeData.outputs.forEach((label, index) => {
        const row = document.createElement('div');
        row.className = 'output-port-wrapper';
        row.innerHTML = `<span style="font-size:0.8rem; margin-right:5px;">${label}</span>`;

        const port = document.createElement('div');
        port.className = 'output-port-point';
        port.onmousedown = (e) => startLinking(nodeData.id, index, e);

        row.appendChild(port);
        container.appendChild(row);
    });
}

function updateNodePosition(id, x, y) {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    node.x = x;
    node.y = y;
    const el = document.getElementById(`node-${id}`);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    updateConnections();
    renderMinimap();
}

function deleteNode(id) {
    nodes = nodes.filter(n => n.id !== id);
    connections = connections.filter(c => c.from !== id && c.to !== id);
    const el = document.getElementById(`node-${id}`);
    if (el) el.remove();
    updateConnections();
    renderMinimap();
}

// --- Connections ---

function startLinking(nodeId, portIndex, e) {
    e.stopPropagation();
    e.preventDefault();
    linkingFrom = { nodeId, portIndex };

    tempConnectionLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempConnectionLine.setAttribute('stroke', '#cbd5e1');
    tempConnectionLine.setAttribute('stroke-width', '2');
    tempConnectionLine.setAttribute('fill', 'none');
    tempConnectionLine.setAttribute('stroke-dasharray', '5,5');
    connectionsLayer.appendChild(tempConnectionLine);
}

function updateTempLine(mouseX, mouseY) {
    if (!linkingFrom) return;

    // Start Point (Port)
    const startPoint = getPortPosition(linkingFrom.nodeId, 'output', linkingFrom.portIndex);
    if (!startPoint) return;

    // End Point (Mouse Canvas Coords)
    const endPoint = getCanvasCoords(mouseX, mouseY);

    drawBezier(tempConnectionLine, startPoint.x, startPoint.y, endPoint.x, endPoint.y);
}

function finishLinking(targetNodeId, e) {
    e.stopPropagation(); // Prevent canvas selection
    if (linkingFrom && linkingFrom.nodeId !== targetNodeId) {
        // Prevent dupes
        const exists = connections.some(c =>
            c.from === linkingFrom.nodeId && c.fromPort === linkingFrom.portIndex && c.to === targetNodeId
        );
        if (!exists) {
            connections.push({
                from: linkingFrom.nodeId,
                fromPort: linkingFrom.portIndex,
                to: targetNodeId
            });
            updateConnections();
        }
    }
    stopLinking();
}

function stopLinking() {
    linkingFrom = null;
    if (tempConnectionLine) {
        tempConnectionLine.remove();
        tempConnectionLine = null;
    }
}

// THE ALIGNMENT FIX:
function getPortPosition(nodeId, type, index) {
    const nodeEl = document.getElementById(`node-${nodeId}`);
    if (!nodeEl) return null;

    let portEl;
    if (type === 'input') {
        portEl = nodeEl.querySelector('.node-input');
    } else {
        const ports = nodeEl.querySelectorAll('.output-port-point');
        portEl = ports[index];
    }

    if (!portEl) return null;

    // Get Bounding Rect (Screen Coords)
    const rect = portEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Convert to Canvas Coords
    return getCanvasCoords(centerX, centerY);
}

function updateConnections() {
    // Re-draw all lines
    // Clear old lines
    Array.from(connectionsLayer.children).forEach(child => {
        if (child !== tempConnectionLine) child.remove();
    });

    connections.forEach(conn => {
        const p1 = getPortPosition(conn.from, 'output', conn.fromPort);
        const p2 = getPortPosition(conn.to, 'input');

        if (p1 && p2) {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('class', 'connection-line');
            path.ondblclick = () => {
                connections = connections.filter(c => c !== conn);
                updateConnections();
            };
            drawBezier(path, p1.x, p1.y, p2.x, p2.y);
            connectionsLayer.appendChild(path);
        }
    });
}

function drawBezier(pathEl, x1, y1, x2, y2) {
    const dist = Math.abs(x2 - x1) * 0.5;
    const cp1x = x1 + dist;
    const cp2x = x2 - dist;
    pathEl.setAttribute('d', `M ${x1} ${y1} C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`);
}

function addOption(nodeId) {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
        node.outputs.push('Option ' + (node.outputs.length + 1));
        // Remove old output elements to rerender
        const el = document.getElementById(`node-${nodeId}`);
        const container = el.querySelector('.outputs-container');
        renderOutputs(node, container);
        updateConnections(); // Port positions might shift
    }
}

// --- Minimap ---
function renderMinimap() {
    minimap.innerHTML = '';
    // Simple scaling to fit nodes
    // Find bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(n => {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + 200);
        maxY = Math.max(maxY, n.y + 100);
    });

    // Add some padding
    minX -= 500; minY -= 500; maxX += 500; maxY += 500;

    const width = maxX - minX;
    const height = maxY - minY;

    // Map scale
    const mapW = minimap.clientWidth;
    const mapH = minimap.clientHeight;
    const scaleX = mapW / width;
    const scaleY = mapH / height;
    const mScale = Math.min(scaleX, scaleY);

    nodes.forEach(n => {
        const d = document.createElement('div');
        d.className = 'mini-node';
        d.style.left = (n.x - minX) * mScale + 'px';
        d.style.top = (n.y - minY) * mScale + 'px';
        d.style.width = 200 * mScale + 'px';
        d.style.height = 100 * mScale + 'px';
        minimap.appendChild(d);
    });
}

// Global exposure for onClick handlers
window.deleteNode = deleteNode;
window.addOption = addOption;

// --- Persistence ---

const API_BASE = 'http://127.0.0.1:8000';
const urlParams = new URLSearchParams(window.location.search);
const pageId = urlParams.get('id') || 3; // Default to ID 3 for testing

async function saveCanvas() {
    const data = {
        nodes,
        connections,
        nextId,
        canvasX,
        canvasY,
        scale
    };

    try {
        const response = await fetch(`${API_BASE}/api/flow/save/${pageId}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        if (response.ok) {
            alert('Flow saved to backend successfully!');
        } else {
            alert('Error saving flow: ' + result.message);
        }
    } catch (e) {
        console.error("Save failed", e);
        alert('Network error saving flow.');
    }
}

async function loadCanvas() {
    try {
        const response = await fetch(`${API_BASE}/api/flow/get/${pageId}/`);
        if (response.ok) {
            const data = await response.json();

            if (data && data.nodes && data.nodes.length > 0) {
                nodes = data.nodes || [];
                connections = data.connections || [];
                nextId = data.nextId || 1;
                canvasX = data.canvasX || -2000;
                canvasY = data.canvasY || -2000;
                scale = data.scale || 1;

                // Clear current DOM nodes
                document.querySelectorAll('.node').forEach(el => el.remove());

                // Render loaded nodes
                nodes.forEach(n => {
                    renderNode(n);
                    // Need to potentially re-attach any listeners or specific data handling?
                    // renderNode handles creating DOM from n.data.
                });
                updateTransform();
                updateConnections();
                renderMinimap();
                return;
            }
        }
    } catch (e) {
        console.error("Load failed", e);
    }

    // Fallback if no data or error
    loadDefault();
}

function loadDefault() {
    if (nodes.length === 0) {
        createNode('start', 2200, 2200);
        createNode('instruction', 2500, 2200);
    }
}

function clearCanvas() {
    if (confirm('Are you sure you want to clear the canvas? This will wipe the current view.')) {
        nodes = [];
        connections = [];
        document.querySelectorAll('.node').forEach(el => el.remove());
        updateConnections(); // clears lines
        renderMinimap();
    }
}

init();
