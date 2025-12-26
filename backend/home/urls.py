from django.urls import path
from .api_views import save_flow_view, get_flow_view

urlpatterns = [
    path('api/flow/save/<int:page_id>/', save_flow_view, name='save_flow'),
    path('api/flow/get/<int:page_id>/', get_flow_view, name='get_flow'),
]
