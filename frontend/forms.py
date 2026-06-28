"""Formulaires du front (couche dialogue)."""
from __future__ import annotations

from django import forms

from matchmaking.models import OpponentType, StakeKind


class RegisterForm(forms.Form):
    phone = forms.CharField(label="Téléphone", max_length=32)
    email = forms.EmailField(label="E-mail")
    username = forms.CharField(label="Pseudo", max_length=150)
    password = forms.CharField(label="Mot de passe", widget=forms.PasswordInput, min_length=8)


class VerifyForm(forms.Form):
    email = forms.EmailField(label="E-mail")
    code = forms.CharField(label="Code reçu par e-mail", max_length=8)


class LoginForm(forms.Form):
    username = forms.CharField(label="Pseudo")
    password = forms.CharField(label="Mot de passe", widget=forms.PasswordInput)


class DepositForm(forms.Form):
    amount = forms.IntegerField(label="Montant (XAF)", min_value=1)
    method = forms.ChoiceField(label="Moyen", choices=[("momo", "Mobile money"), ("card", "Carte")])


class ChallengeForm(forms.Form):
    opponent_type = forms.ChoiceField(label="Adversaire", choices=OpponentType.choices)
    stake_kind = forms.ChoiceField(label="Poche", choices=StakeKind.choices)
    bet_amount = forms.IntegerField(label="Mise (XAF)", min_value=1)


class JoinByCodeForm(forms.Form):
    access_code = forms.CharField(label="Code d'accès", max_length=16)
