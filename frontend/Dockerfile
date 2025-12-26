# Use Nginx to serve the static content
FROM nginx:alpine

# Copy the frontend files to Nginx's html directory
COPY . /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
