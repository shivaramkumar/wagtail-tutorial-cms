const API_BASE = 'http://127.0.0.1:8000/api/v2';
const app = document.getElementById('app');

let tutorials = [];
let currentTutorial = null;

async function init() {
    try {
        // Fetch pages of type TutorialPage, including fields 'steps' and 'description'
        const response = await fetch(`${API_BASE}/pages/?type=home.TutorialPage&fields=steps,description`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        tutorials = data.items;
        renderTutorialList();
    } catch (error) {
        console.error(error);
        app.innerHTML = `
            <div class="card">
                <h2 style="color: #ef4444">Error connecting to server</h2>
                <p>Could not fetch tutorials. Make sure the backend is running on port 8000.</p>
                <div style="margin-top:20px; padding:10px; background: rgba(0,0,0,0.3); border-radius:8px; font-family:monospace; font-size:0.9em;">
                    ${error.message}
                </div>
                <button class="btn-option" style="margin-top:20px" onclick="init()">Retry</button>
            </div>`;
    }
}

function renderTutorialList() {
    if (tutorials.length === 0) {
        app.innerHTML = `<div class="card"><h2>No Tutorials Found</h2><p>Please add some tutorials in the Wagtail Admin (http://127.0.0.1:8000/admin).</p></div>`;
        return;
    }

    const listHtml = tutorials.map(t => `
        <div class="card tutorial-item" style="margin-bottom: 20px; cursor: pointer;" onclick="loadTutorial(${t.id})">
            <h2 class="step-title" style="margin-bottom:10px">${t.title}</h2>
            <p style="color:var(--text-secondary)">${t.description || 'No description available.'}</p>
        </div>
    `).join('');

    app.innerHTML = `<div class="tutorial-list">${listHtml}</div>`;
}

// Attach to window so onclick works
window.loadTutorial = function(id) {
    const tutorial = tutorials.find(t => t.id === id);
    if (!tutorial) return;
    currentTutorial = tutorial;
    
    if (tutorial.steps && tutorial.steps.length > 0) {
        renderStep(tutorial.steps[0]);
    } else {
        app.innerHTML = `<div class="card"><h2>Empty Tutorial</h2><p>This tutorial has no steps.</p><button class="btn-option" onclick="renderTutorialList()">Back</button></div>`;
    }
}

function renderStep(stepBlock) {
    // stepBlock structure: { type: 'step', value: { step_id, title, content, options } }
    
    // Note: If the streamfield API structure differs, we might need to adjust.
    // Wagtail v2 API returns StreamField as: [{ type: 'step', value: {...} }]
    
    const step = stepBlock.value;
    
    // Process content stream
    const contentHtml = step.content.map(block => {
        if (block.type === 'text') {
            return `<div class="rich-text">${block.value}</div>`;
        }
        if (block.type === 'image') {
            // block.value is the Image ID
            return `<div class="image-wrapper" data-image-id="${block.value}">
                <div class="loading-image" style="padding:20px; text-align:center; background:rgba(0,0,0,0.2); border-radius:8px">Loading Image...</div>
            </div>`;
        }
        if (block.type === 'video') {
            // block.value is the embed HTML string provided by Wagtail EmbedBlock
            return `<div class="video-wrapper">${block.value}</div>`;
        }
        return '';
    }).join('');

    const optionsHtml = step.options.map(opt => `
        <button class="btn-option" onclick="handleOption('${opt.next_step_id}')">
            ${opt.label}
        </button>
    `).join('');

    app.innerHTML = `
        <div class="card">
            <button onclick="renderTutorialList()" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; margin-bottom:10px; padding:0;">← Back to Tutorials</button>
            <h2 class="step-title">${step.title}</h2>
            <div class="step-content">${contentHtml}</div>
            <div class="options-grid">
                ${optionsHtml}
            </div>
            ${optionsHtml.length === 0 ? '<div style="margin-top:20px"><button class="btn-option" onclick="renderTutorialList()">Finish</button></div>' : ''}
        </div>
    `;

    // Post-load images
    document.querySelectorAll('.image-wrapper').forEach(async el => {
        const id = el.dataset.imageId;
        try {
            const res = await fetch(`${API_BASE}/images/${id}/`);
            if (res.ok) {
                const imgData = await res.json();
                // Wagtail images API returns 'meta' with 'download_url' usually, or separate renditions.
                // Standard v2 images/id/ returns basic info.
                // We'll use meta.download_url if available, or just a placeholder if not configured to serve directly.
                const src = imgData.meta.download_url;
                el.innerHTML = `<img src="${src}" class="content-image" alt="${imgData.title}">`;
            }
        } catch (e) {
            el.innerHTML = `<div style="color:red">Failed to load image</div>`;
        }
    });
}

window.handleOption = function(nextStepId) {
    if (!nextStepId) {
        // End of flow logic if handled by empty next_step_id
        renderTutorialList(); 
        return;
    }

    const nextStep = currentTutorial.steps.find(s => s.value.step_id === nextStepId);
    if (nextStep) {
        renderStep(nextStep);
    } else {
        alert('Next step not found: ' + nextStepId);
    }
}

init();
