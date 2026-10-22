// jsdom lacks a working showModal()/close(); mimic the parts the app uses.
const proto = HTMLDialogElement.prototype;
if (typeof proto.showModal !== 'function') {
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
}
if (typeof proto.close !== 'function') {
  proto.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
