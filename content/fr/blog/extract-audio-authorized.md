---
id: extract-audio-authorized
slug: enregistrer-audio-video-facebook
title: "Enregistrer ou extraire le son d'une vidéo : ce qu'il faut savoir quand on y est autorisé"
description: "Quand il est approprié d'enregistrer ou d'extraire l'audio d'une vidéo Facebook, ce que le téléchargeur peut ou non proposer, et des moyens sûrs d'obtenir le son de fichiers que vous possédez."
published: 2026-10-29
---

# Enregistrer ou extraire le son d'une vidéo : ce qu'il faut savoir quand on y est autorisé

On veut récupérer le son d'une vidéo pour de bonnes raisons : un mémo vocal enregistré en vidéo, une intervention que l'on a donnée, un cours à écouter en marchant, ou un morceau que l'on a soi-même interprété. Cet article explique quand il est approprié de prendre l'audio, ce que ce site peut et ne peut pas fournir, et comment extraire le son de fichiers vidéo que vous possédez légitimement.

## Commencez par les règles, pas par l'outil

Le son est un contenu comme un autre. La bande-son d'un Reel peut contenir la voix d'une personne, de la musique, un enregistrement protégé par le droit d'auteur, ou tout cela à la fois. Avant d'extraire quoi que ce soit, posez-vous trois questions :

1. **Est-ce à moi ?** S'agit-il d'une vidéo que j'ai filmée ou créée moi-même ?
2. **Ai-je une autorisation ?** Le créateur ou le titulaire des droits a-t-il dit que je pouvais la conserver ou la réutiliser ?
3. **La loi ou une licence permet-elle mon usage ?** Les règles varient selon les pays, et une copie privée n'est pas la même chose qu'une republication.

La musique mérite une attention particulière. Les Reels utilisent souvent des morceaux sous licence, et avoir le droit d'écouter un morceau dans Facebook n'est pas le droit de le copier, de le réutiliser ou de le diffuser. Si vous cherchez de la musique pour vos propres Reels, regardez ce que la plateforme propose aux créateurs (par exemple la Sound Collection de Meta) plutôt que d'extraire le son de la vidéo de quelqu'un d'autre. Notre article sur le [droit d'auteur, la vie privée et l'usage responsable](blog:copyright-privacy-responsible-use) va plus loin.

## Ce que ce site peut proposer

Quand vous vérifiez un lien dans [le téléchargeur](page:home), la liste des résultats n'affiche que les options qui existent réellement pour cette vidéo. Dans certains cas, cela peut inclure une entrée audio ; dans beaucoup de cas, non. Nous n'ajoutons pas un bouton MP3 simplement parce que les gens s'y attendent : il n'apparaît que si le service renvoie réellement un fichier audio.

La réponse honnête à « puis-je obtenir un MP3 ? » est donc : **seulement si une option audio apparaît pour votre vidéo.** Si elle n'apparaît pas, ce n'est pas un bug. Cela signifie qu'il n'y a rien à proposer.

## La méthode fiable : extraire le son d'un fichier que vous possédez

Si la vidéo est la vôtre, la méthode la plus fiable ne passe par aucun service en ligne.

### 1. Utilisez votre fichier d'origine

Les vidéos que vous avez filmées se trouvent sur votre téléphone ou votre ordinateur. Votre original vaut mieux que tout ce qui est téléchargé depuis une plateforme, car les plateformes compressent les fichiers. Si vous gérez une Page ou un compte, les outils de votre compte peuvent vous permettre de télécharger vos propres publications (par exemple Meta Business Suite pour les Pages, ou l'export « Télécharger vos informations » dans les paramètres du compte ; les noms des menus changent avec le temps).

### 2. Extrayez l'audio avec un outil local

Une fois que vous avez un fichier vidéo que vous avez le droit d'utiliser, des outils gratuits peuvent en extraire le son.

**VLC media player** (Windows, Mac, Linux) : ouvrez **Média → Convertir / Enregistrer**, ajoutez votre vidéo, choisissez un profil audio comme MP3, définissez un fichier de destination et lancez la conversion.

**FFmpeg** (outil en ligne de commande, pour les personnes à l'aise avec un terminal) :

```
ffmpeg -i entree.mp4 -vn -c:a copy sortie.m4a
```

Cette commande copie la piste audio existante sans la ré-encoder : il n'y a donc aucune perte de qualité. L'extension du fichier doit correspondre à l'audio qu'il contient ; pour la plupart des vidéos de téléphone, c'est de l'AAC, donc `.m4a` convient. Pour convertir en MP3 à la place :

```
ffmpeg -i entree.mp4 -vn -c:a libmp3lame -q:a 2 sortie.mp3
```

**Applications de montage :** beaucoup d'éditeurs vidéo pour téléphone peuvent exporter l'audio seul. Cherchez « extraire l'audio » ou une option d'export audio uniquement.

### 3. Contrôlez le résultat

Écoutez le fichier du début à la fin. Vérifiez qu'il y a du son, que rien n'est coupé et que le volume est correct. Si l'original contient une musique de fond que vous ne souhaitiez pas, il vaut peut-être mieux refaire l'enregistrement.

## Et si la vidéo appartient à quelqu'un d'autre ?

Demandez. Un court message au créateur (« Puis-je garder le son de votre intervention pour mon écoute personnelle ? ») obtient souvent un oui. Si vous voulez le réutiliser publiquement, il vous faut une licence claire ou une autorisation écrite, et pour la musique, il faut généralement une licence du titulaire des droits.

Certains créateurs publient leur audio sous des licences qui autorisent la réutilisation ; dans ce cas, la licence précise ce qui est permis et si vous devez mentionner l'auteur. Quand l'autorisation n'est pas claire, partez du principe que vous ne l'avez pas.

## Problèmes courants

**Aucune option audio n'apparaît.** Alors aucune n'est disponible pour cette vidéo via ce service. Si la vidéo est la vôtre, utilisez le fichier d'origine.

**Le fichier extrait n'a pas de son.** Certaines vidéos n'ont aucune piste audio, ou le son est dans un format que votre outil n'a pas géré. Essayez un autre outil ou lisez la vidéo pour vérifier qu'elle a du son.

**La qualité audio est faible.** L'audio d'une vidéo en ligne compressée est déjà compressé. L'extraire ne peut pas restituer des détails perdus. Utilisez votre enregistrement d'origine si vous l'avez.

**Le fichier ne se lit pas.** Essayez un autre lecteur (VLC lit presque tout), ou convertissez-le en MP3 ou M4A avec les outils ci-dessus.

## La vie privée compte aussi

L'audio contient souvent la voix de personnes qui n'ont pas accepté d'être enregistrées ni diffusées. Même lorsque vous pouvez légalement conserver une copie, réfléchissez avant de la publier ou de la transférer, surtout si elle comprend des conversations privées ou des enfants. Dans beaucoup d'endroits, publier des enregistrements de personnes identifiables peut créer des obligations juridiques et éthiques.

## À éviter

- Les sites ou applications qui demandent votre mot de passe, vos cookies ou vos jetons Facebook. Un outil pour vidéos publiques n'en a pas besoin.
- Les sites de « MP3 gratuit » envahis de fenêtres publicitaires, de redirections forcées ou de faux boutons de téléchargement.
- Extraire de la musique de vidéos pour l'utiliser dans vos propres publications sans licence : c'est une cause fréquente de retraits et de sanctions sur les comptes.

## En résumé

1. N'extrayez que l'audio qui est à vous ou pour lequel vous avez une autorisation.
2. Ce site n'affiche une option audio que si elle est réellement disponible.
3. Pour vos propres vidéos, utilisez le fichier d'origine et un outil local comme VLC ou FFmpeg.
4. Pour l'audio d'autrui, demandez, et respectez les licences.
5. Pensez à la vie privée avant de partager la voix de quelqu'un.

Pour une aide générale sur l'enregistrement de vidéos, consultez le [guide pas à pas](page:howTo) et, en cas d'échec, le [dépannage des téléchargements](blog:why-download-fails).
