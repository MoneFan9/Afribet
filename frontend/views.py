"""
Vues du front mobile-first (couche dialogue, server-rendered). Auth par **session web** ;
toute la logique reste dans la **service layer** (frontière 3). Le plateau temps réel
utilise l'API WebSocket via un jeton JWT émis pour la session.
"""
from __future__ import annotations

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth import login as auth_login
from django.contrib.auth import logout as auth_logout
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render
from django.views.decorators.http import require_http_methods

from core.errors import DomainError
from core.money import Money

from .forms import ChallengeForm, DepositForm, JoinByCodeForm, LoginForm, RegisterForm, VerifyForm

User = get_user_model()


def landing(request):
    if request.user.is_authenticated:
        return redirect("/dashboard/")
    return render(request, "landing.html")


# --- CU1 : inscription / vérification / connexion (session web) ----------
@require_http_methods(["GET", "POST"])
def register(request):
    from accounts.services import AuthService

    form = RegisterForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        try:
            AuthService().register(**form.cleaned_data)
        except DomainError as exc:
            messages.error(request, str(exc))
        else:
            request.session["pending_email"] = form.cleaned_data["email"]
            messages.success(request, "Compte créé. Un code vous a été envoyé par e-mail.")
            return redirect("/verify/")
    return render(request, "auth/register.html", {"form": form})


@require_http_methods(["GET", "POST"])
def verify(request):
    from accounts.services import AuthService

    initial = {"email": request.session.get("pending_email", "")}
    form = VerifyForm(request.POST or None, initial=initial)
    if request.method == "POST" and form.is_valid():
        try:
            result = AuthService().verify_email_code(**form.cleaned_data)
        except DomainError as exc:
            messages.error(request, str(exc))
        else:
            auth_login(request, result["user"])
            messages.success(request, "Compte vérifié. Bienvenue !")
            return redirect("/dashboard/")
    return render(request, "auth/verify.html", {"form": form})


@require_http_methods(["GET", "POST"])
def login_view(request):
    form = LoginForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        user = authenticate(request, **form.cleaned_data)
        if user is None:
            messages.error(request, "Identifiants invalides ou compte non vérifié.")
        else:
            auth_login(request, user)
            return redirect("/dashboard/")
    return render(request, "auth/login.html", {"form": form})


@require_http_methods(["POST"])
def logout_view(request):
    auth_logout(request)
    return redirect("/")


# --- Dashboard ------------------------------------------------------------
@login_required
def dashboard(request):
    from wallet.services import WalletService

    bal = WalletService().get_balance(request.user)
    return render(request, "dashboard.html", {"balance": bal})


# --- CU2/CU17 : portefeuille ---------------------------------------------
@login_required
@require_http_methods(["GET", "POST"])
def wallet(request):
    from payments.services import PaymentService
    from wallet.services import WalletService

    if request.method == "POST":
        action = request.POST.get("action")
        if action == "deposit":
            form = DepositForm(request.POST)
            if form.is_valid():
                try:
                    amount = Money(form.cleaned_data["amount"], settings.DEFAULT_CURRENCY)
                    pay = PaymentService()
                    intent = pay.deposit(request.user, amount, method=form.cleaned_data["method"])["intent"]
                    # MVP sandbox : confirmation immédiate du dépôt (démonstration).
                    pay.handle_callback("sandbox", {"external_ref": intent.external_ref, "status": "SUCCESS"})
                    messages.success(request, "Dépôt confirmé (sandbox).")
                except DomainError as exc:
                    messages.error(request, str(exc))
        elif action == "convert":
            from bonus.services import BonusService

            try:
                res = BonusService().convert_bonus_to_real(request.user)
                messages.success(request, f"{res['tranches']} tranche(s) converties : +{res['real_credited']} XAF.")
            except DomainError as exc:
                messages.error(request, str(exc))
        return redirect("/wallet/")

    bal = WalletService().get_balance(request.user)
    return render(request, "wallet/wallet.html", {"balance": bal, "deposit_form": DepositForm()})


# --- CU3/CU4 : lobby + création ------------------------------------------
@login_required
@require_http_methods(["GET", "POST"])
def lobby(request):
    from matchmaking.services import MatchmakingService

    if request.method == "POST":
        form = JoinByCodeForm(request.POST)
        if form.is_valid():
            try:
                m = MatchmakingService().join_by_code(joiner=request.user, **form.cleaned_data)
            except DomainError as exc:
                messages.error(request, str(exc))
            else:
                return redirect(f"/match/{m.id}/")
    matches = MatchmakingService().list_open_challenges()
    return render(request, "lobby.html", {"matches": matches, "join_form": JoinByCodeForm()})


@login_required
@require_http_methods(["POST"])
def join(request, match_id):
    from matchmaking.services import MatchmakingService

    try:
        MatchmakingService().join_from_lobby(joiner=request.user, match_id=match_id)
    except DomainError as exc:
        messages.error(request, str(exc))
        return redirect("/lobby/")
    return redirect(f"/match/{match_id}/")


@login_required
@require_http_methods(["GET", "POST"])
def challenge_create(request):
    from matchmaking.services import MatchmakingService

    form = ChallengeForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        try:
            match = MatchmakingService().create_challenge(
                creator=request.user, game_key="songo",
                opponent_type=form.cleaned_data["opponent_type"],
                timing_mode="REALTIME", pairing_mode="AUTO",
                stake_kind=form.cleaned_data["stake_kind"],
                bet_amount=Money(form.cleaned_data["bet_amount"], settings.DEFAULT_CURRENCY),
            )
        except DomainError as exc:
            messages.error(request, str(exc))
        else:
            return redirect(f"/match/{match.id}/")
    return render(request, "challenge_create.html", {"form": form})


@login_required
@require_http_methods(["POST"])
def train(request):
    from matchmaking.services import MatchmakingService

    try:
        match = MatchmakingService().create_training_match(creator=request.user, ai_level="VIEUX_SAGE")
    except DomainError as exc:
        messages.error(request, str(exc))
        return redirect("/dashboard/")
    return redirect(f"/match/{match.id}/")


# --- CU5 : plateau temps réel --------------------------------------------
@login_required
def match(request, match_id):
    from accounts.services import issue_tokens
    from matchmaking.models import Match

    m = Match.objects.filter(id=match_id).first()
    if m is None or request.user.id not in (m.player_1_id, m.player_2_id):
        messages.error(request, "Match introuvable ou accès refusé.")
        return redirect("/dashboard/")
    ws_token = issue_tokens(request.user)["access"]  # pont session → JWT pour le WebSocket
    my_index = m.index_for_user(request.user)
    return render(request, "match/board.html", {"match": m, "ws_token": ws_token, "my_index": my_index})
