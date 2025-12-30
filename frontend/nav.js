document.addEventListener("DOMContentLoaded", () => {
    const navHTML = `
        <nav class="top-nav">
            <div class="nav-left">
                <a href="index.html" class="nav-brand">Troubleshooting Hub</a>
            </div>
            <div class="nav-right">
                <a href="editor.html" class="nav-link">Flow Editor</a>
                <div id="user-info">Loading...</div>
            </div>
        </nav>
    `;

    // Prepend nav to body
    document.body.insertAdjacentHTML("afterbegin", navHTML);

    // Fetch User Status
    fetch("http://127.0.0.1:8000/api/v2/me/")
        .then(res => res.json())
        .then(data => {
            const userContainer = document.getElementById("user-info");
            if (data.is_authenticated) {
                userContainer.innerHTML = `
                    <span class="greeting">Hello, <strong>${data.username}</strong></span>
                    <a href="http://127.0.0.1:8000${data.admin_url}" class="btn-sm">Admin</a>
                    <button id="logout-btn" class="btn-sm" style="background:rgba(239, 68, 68, 0.2); border-color:#ef4444;">Logout</button>
                `;

                document.getElementById('logout-btn').onclick = () => {
                    fetch('http://127.0.0.1:8000/api/logout/', { method: 'POST' })
                        .then(() => window.location.reload());
                };
            } else {
                // If on editor page, maybe redirect? Or just show Login link
                userContainer.innerHTML = `
                    <span class="greeting" style="margin-right:10px">Guest</span>
                `;
            }
        })
        .catch(err => {
            console.error("Failed to fetch user info:", err);
            document.getElementById("user-info").innerText = "Offline";
        });
});
