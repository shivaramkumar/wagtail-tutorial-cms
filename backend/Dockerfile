# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt /app/
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy project
COPY . /app/

# Run gunicorn
# CMD ["gunicorn", "tutorial_cms.wsgi:application", "--bind", "0.0.0.0:8000"]
# For development/mockup simplicity, we can reuse manage.py runserver, 
# but gunicorn is better for 'production-like' docker.
# The user asked for "docker running backend", usually implying production-ish.
# Let's use manage.py runserver for now to keep it consistent with the dev environment 
# and avoid slight differences in static file serving unless we set up whitenoise.
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
