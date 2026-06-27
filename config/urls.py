"""
Routing HTTP racine. Les routes par app (conception §Navigation) sont branchées
au fil des phases : accounts (CU1), wallet (CU2/CU7), matchmaking (CU3-CU4)...
"""
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),  # CU1, EF2
    path("api/payments/", include("payments.urls")),  # CU2, CU7
    path("api/matches/", include("matchmaking.urls")),  # CU3-CU8
]
