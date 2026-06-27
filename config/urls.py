"""
Routing HTTP racine. Les routes par app (conception §Navigation) sont branchées
au fil des phases : accounts (CU1), wallet (CU2/CU7), matchmaking (CU3-CU4)...
"""
from django.contrib import admin
from django.urls import path

urlpatterns = [
    path("admin/", admin.site.urls),
]
