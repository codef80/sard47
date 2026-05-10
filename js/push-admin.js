// =============================================
// sard/js/push-admin.js — تنبيهات السوبر أدمن عبر Web Push
// =============================================
const SardPush = {
  isSupported(){
    return ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
  },

  isStandalone(){
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  },

  urlBase64ToUint8Array(base64String){
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  },

  async getRegistration(){
    return await navigator.serviceWorker.register('./service-worker.js', { scope: './' });
  },

  async getSubscription(){
    if (!this.isSupported()) return null;
    const reg = await this.getRegistration();
    return await reg.pushManager.getSubscription();
  },

  async saveSubscription(subscription){
    const profile = window.S?.user || await SardAPI.getCurrentUser();
    if (!profile || profile.role !== 'superadmin') throw new Error('تنبيهات الإدارة مخصصة للسوبر أدمن فقط');

    const json = subscription.toJSON();
    const row = {
      admin_user_id: profile.id,
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      user_agent: navigator.userAgent,
      platform: this.isStandalone() ? 'pwa' : 'browser',
      enabled: true,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await _sb
      .from('admin_push_subscriptions')
      .upsert(row, { onConflict: 'endpoint' });
    if (error) throw error;
    return row;
  },

  async enable(){
    if (!this.isSupported()) throw new Error('المتصفح لا يدعم Web Push Notifications');
    const publicKey = SARD_CONFIG?.push?.vapidPublicKey;
    if (!publicKey) throw new Error('مفتاح VAPID العام غير مضاف في js/config.js');

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('لم يتم السماح بالتنبيهات من الآيفون/المتصفح');

    const reg = await this.getRegistration();
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(publicKey)
      });
    }
    await this.saveSubscription(subscription);
    return subscription;
  },

  async disable(){
    const subscription = await this.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await _sb.from('admin_push_subscriptions').update({ enabled:false, updated_at:new Date().toISOString() }).eq('endpoint', endpoint);
      await subscription.unsubscribe().catch(()=>{});
    }
  },

  async sendTest(){
    return await SardAPI.notifySuperAdmin('test', {
      title: 'تنبيه تجريبي',
      body: 'وصلت تنبيهات السوبر أدمن بنجاح ✅',
      url: './superadmin.html'
    });
  },

  async getStatus(){
    if (!this.isSupported()) return { supported:false, permission:'unsupported', subscribed:false };
    const sub = await this.getSubscription().catch(()=>null);
    return { supported:true, permission:Notification.permission, subscribed:!!sub, standalone:this.isStandalone() };
  }
};

window.SardPush = SardPush;
