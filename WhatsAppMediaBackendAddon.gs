/*
 * Natsha Family — WhatsApp media backend support
 *
 * This file documents the media helpers integrated into the full
 * FamilyNotificationsBackend_MEDIA_READY.gs build delivered on 2026-08-11.
 *
 * Required Settings sheet keys (already configured):
 * WHATSAPP_TEMPLATE_GENERAL=family_general_v1
 * WHATSAPP_TEMPLATE_GENERAL_IMAGE=family_general_image_v1
 * WHATSAPP_TEMPLATE_GENERAL_VIDEO=family_general_video_v1
 * WHATSAPP_TEMPLATE_EVENT=family_event_v1
 * WHATSAPP_TEMPLATE_DEATH=family_condolence_v1
 * ANNOUNCEMENT_MEDIA_FOLDER_ID=<Drive folder id>
 *
 * Required announcement columns (already configured):
 * رابط الوسائط
 * نوع الوسائط
 *
 * The complete integrated backend additionally:
 * 1) adds uploadAnnouncementMedia to doPost,
 * 2) saves mediaUrl/mediaType in publishAnnouncement_,
 * 3) routes WhatsApp via sendWhatsAppBroadcastV2_,
 * 4) selects text/image/video templates automatically for type عام.
 *
 * The GitHub Pages admin UI is wired by family-admin-media-addon.js.
 */
