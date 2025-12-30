from django.urls import path
from .api_views import save_flow_view, get_flow_view, current_user_view, login_view, logout_view

urlpatterns = [
    path('api/flow/save/<int:page_id>/', save_flow_view, name='save_flow'),
    path('api/flow/get/<int:page_id>/', get_flow_view, name='get_flow'),
    path('api/v2/me/', current_user_view, name='current_user'),
    path('api/login/', login_view, name='api_login'),
    path('api/logout/', logout_view, name='api_logout'),
]
