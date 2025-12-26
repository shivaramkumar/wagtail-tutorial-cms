# Tutorial CMS Mockup

A developer troubleshooting guide platform featuring a **Wagtail CMS Backend** and a premium **Vanilla JS Frontend** with a visual Flow Editor.

## Project Structure

*   `backend/`: Django/Wagtail project. Handles data models, content management, and API.
*   `frontend/`: Static web application. Fetches data from the backend to render tutorials and provides an editor interface.
*   `.local/`: Developer documentation and plans.

## Prerequisites

*   Python 3.8+
*   pip (Python package manager)

## Setup Instructions

### 1. Backend Setup

1.  Navigate to the project root.
2.  Create a virtual environment (if not already active):
    ```bash
    python3 -m venv venv
    source venv/bin/activate  # On Windows use `venv\Scripts\activate`
    ```
3.  Install dependencies:
    ```bash
    pip install wagtail django-cors-headers
    ```
4.  Initialize the database:
    ```bash
    cd backend
    python3 manage.py migrate
    ```
5.  Create a superuser (for Wagtail Admin access):
    ```bash
    python3 manage.py createsuperuser
    ```

### 2. Frontend Setup

The frontend is a static site. No complex build step is required, but it must be served via a web server to avoid CORS issues with the backend API.

## Running the Application

### Step 1: Start the Backend Server

The backend runs on **port 8000**.

```bash
# In the repository root, with venv activated:
cd backend
python3 manage.py runserver
```

*   **Admin Interface**: [http://127.0.0.1:8000/admin](http://127.0.0.1:8000/admin)
*   **API Root**: [http://127.0.0.1:8000/api/v2/](http://127.0.0.1:8000/api/v2/)

### Step 2: Start the Frontend Server

Open a **new terminal window** or tab. The frontend typically runs on **port 8081** (or any other free port).

```bash
# In the repository root:
cd frontend
python3 -m http.server 8081
```

*   **User App**: [http://localhost:8081/index.html](http://localhost:8081/index.html)
*   **Flow Editor**: [http://localhost:8081/editor.html](http://localhost:8081/editor.html)

> **Important**: Do not try to access `index.html` via the backend port (8000). The backend only serves the API and the Admin UI. The frontend must be served separately.

## How to Use

### Creating Tutorials (Wagtail Admin)

1.  Go to `http://127.0.0.1:8000/admin` and log in.
2.  Navigate to **Pages**.
3.  Create a new **Tutorial Page**.
4.  Add a Title and Description.
5.  In the **Steps** streamfield:
    *   Add **Steps** with IDs, Titles, and Content (Text/Image/Video).
    *   Add **Options** to link steps together (use the `Next Step ID` to define the flow).
6.  Publish the page.

### Using the Visual Flow Editor

1.  Go to `http://localhost:8081/editor.html`.
2.  **Drag** nodes from the sidebar Toolbox to the canvas.
3.  **Connect** nodes by dragging from the Blue dot (Output) of one node to the Green dot (Input) of another.
4.  **Edit** node content directly on the card.
5.  **Add Options** to Condition nodes to branch your logic.
    *   *(Note: Currently, the Editor is a frontend prototype and does not save back to the API automatically. It demonstrates the visual building capability.)*

### Viewing Tutorials

1.  Go to `http://localhost:8081/index.html`.
2.  Select a tutorial from the list.
3.  Follow the troubleshooting steps interactively.
