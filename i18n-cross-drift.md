# rent ↔ swap 跨目录同义中文译法清单（阶段 2 · 跨目录对齐）

生成日期：2026-09-29（内部译法统一 + 重复 key 清理后重生成）　｜　来源：`locales/rent/zh-CN.json` × `locales/swap/zh-CN.json` 按**中文值分组**比对（`demo.*` 已排除）

前置：两端各自内部已完成「一句中文一个 key、一个译法」（含重复 key 合并到 `common.*`）。

- 共有同中文 **418** 条，译法不一致 **52** 条（**已全部落地，当前漂移 0**）
- 每条末尾留 `裁决：` 行，填 `rent` / `swap` / 自定义译法；落地时把两端对应 key 统一为该译法
- 裁决顺序（AGENTS.md §5）：① `common.*` 已登记 → ② 术语基线 → ③ `rent/`（权威产物）侧
- 已定规则：**货币**统一简称（`CNY`/`HKD`/`IDR`）；**国际专名**（`VIN`/`KYC`/`SN`…）外语保留原文、中文除外
- 注意：`common.*` 键在两目录共享同值，改动会同时影响两端

### 1. {label}已复制
- 键：rent `user.common.copiedFormat` ｜ swap `merchant.common.copiedLabel`
- **th**：rent `คัดลอก {label} แล้ว` ｜ swap `คัดลอก{label}แล้ว`
- 裁决：rent

### 2. {source}：已选中一张图片
- 键：rent `user.idInfo.photoSelected` ｜ swap `user.idInfo.photoSelected`
- **en**：rent `{source}: 1 image selected` ｜ swap `{source}: one image selected`
- **id**：rent `{source}: 1 gambar dipilih` ｜ swap `{source}: satu gambar dipilih`
- **th**：rent `{source}: เลือกรูปภาพ 1 รูป` ｜ swap `{source}: เลือกรูปภาพหนึ่งรูป`
- 裁决：rent

### 3. 《用户隐私政策》
- 键：rent `user.profile.privacyPolicy` ｜ swap `user.login.privacyPolicyLink`
- **en**：rent `User Privacy Policy` ｜ swap `Privacy Policy`
- **id**：rent `Kebijakan Privasi Pengguna` ｜ swap `Kebijakan Privasi`
- **th**：rent `นโยบายความเป็นส่วนตัวของผู้ใช้` ｜ swap `นโยบายความเป็นส่วนตัว`
- **zh-HK**：rent `《用戶隱私政策》` ｜ swap `《隱私政策》`
- 裁决：rent

### 4. 上传图片
- 键：rent `user.idInfo.addImage` ｜ swap `action.uploadImage`
- **en**：rent `Add Image` ｜ swap `Upload Image`
- **id**：rent `Tambah Gambar` ｜ swap `Unggah Gambar`
- **th**：rent `เพิ่มรูปภาพ` ｜ swap `อัปโหลดรูปภาพ`
- **zh-HK**：rent `新增圖片` ｜ swap `上傳圖片`
- 裁决：swap

### 5. 保存成功
- 键：rent `user.common.saveSuccess` ｜ swap `merchant.common.saveSuccess`
- **en**：rent `Saved successfully` ｜ swap `Saved`
- **id**：rent `Berhasil disimpan` ｜ swap `Tersimpan`
- **th**：rent `บันทึกสำเร็จ` ｜ swap `บันทึกแล้ว`
- 裁决：rent

### 6. 允许后设备可正常放电
- 键：rent `merchant.battery.dischargeAllow` ｜ swap `merchant.battery.dischargeAllow`
- **en**：rent `After enabling, the device can discharge normally` ｜ swap `The device can discharge normally after enabling`
- **id**：rent `Setelah diizinkan, perangkat dapat melepas muatan secara normal` ｜ swap `Perangkat dapat melakukan discharge seperti biasa setelah diaktifkan`
- **th**：rent `หลังจากเปิดใช้งาน อุปกรณ์สามารถปล่อยประจุได้ตามปกติ` ｜ swap `อุปกรณ์จะคายประจุได้ตามปกติหลังเปิดใช้งาน`
- 裁决：rent

### 7. 共 {n} 条
- 键：rent `merchant.alert.historyCount` ｜ swap `merchant.common.totalItems`
- **en**：rent `{n} records total` ｜ swap `Total {n}`
- **id**：rent `Total {n} catatan` ｜ swap `Total {n}`
- 裁决：swap

### 8. 功能控制
- 键：rent `merchant.vehicles.functionControl` ｜ swap `demoOps.functionControl`
- **th**：rent `การควบคุมฟังก์ชัน` ｜ swap `ควบคุมฟังก์ชัน`
- **zh-HK**：rent `功能控制` ｜ swap `功能控製`
- 裁决：rent

### 9. 去登录
- 键：rent `user.common.goLogin` ｜ swap `action.goLogin`
- **en**：rent `Log in` ｜ swap `Sign In`
- **zh-HK**：rent `前往登入` ｜ swap `去登入`
- 裁决：rent

### 10. 启用
- 键：rent `merchant.status.enabled` ｜ swap `merchant.cabinet.enable`
- **en**：rent `Enabled` ｜ swap `Enable`
- **id**：rent `Aktif` ｜ swap `Aktifkan`
- 裁决：rent

### 11. 商户端
- 键：rent `merchant.orders.refundSourceMerchant` ｜ swap `frame.mode.merchant`
- **en**：rent `Merchant APP` ｜ swap `Merchant App`
- **id**：rent `Aplikasi Mitra` ｜ swap `Aplikasi Merchant`
- **th**：rent `แอปร้านค้า` ｜ swap `แอปผู้ค้า`
- 裁决：swap

### 12. 处理中...
- 键：rent `user.home.alertFilterProcessing` ｜ swap `label.processing`
- **en**：rent `Processing` ｜ swap `Processing...`
- **id**：rent `Diproses` ｜ swap `Memproses...`
- **th**：rent `กำลังดำเนินการ` ｜ swap `กำลังดำเนินการ...`
- **zh-HK**：rent `處理中` ｜ swap `處理中...`
- 裁决：swap

### 13. 复制成功
- 键：rent `merchant.orders.idCopied` ｜ swap `label.copied`
- **id**：rent `Tersalin` ｜ swap `Disalin`
- **zh-HK**：rent `已複製` ｜ swap `複製成功`
- 裁决：swap

### 14. 天
- 键：rent `user.orders.unitDay` ｜ swap `label.unit.day`
- **en**：rent `Days` ｜ swap ` days`
- **id**：rent `Hari` ｜ swap ` hari`
- **th**：rent `วัน` ｜ swap ` วัน`
- 裁决：rent

### 15. 实名详情
- 键：rent `user.idInfo.detail` ｜ swap `user.id.detailTitle`
- **en**：rent `KYC Details` ｜ swap `Identity Details`
- **id**：rent `Detail KYC` ｜ swap `Detail Identitas`
- **th**：rent `รายละเอียด KYC` ｜ swap `รายละเอียดการยืนยันตัวตน`
- 裁决：rent

### 16. 已允许放电
- 键：rent `merchant.battery.dischargeAllowed` ｜ swap `merchant.battery.dischargeAllowed`
- **en**：rent `Discharge allowed` ｜ swap `Discharge enabled`
- **id**：rent `Pengosongan diizinkan` ｜ swap `Discharge diaktifkan`
- **th**：rent `อนุญาตการปล่อยประจุ` ｜ swap `เปิดใช้งานการคายประจุแล้ว`
- 裁决：rent

### 17. 已禁止放电
- 键：rent `merchant.battery.dischargeForbidden` ｜ swap `merchant.battery.dischargeForbidden`
- **en**：rent `Discharge forbidden` ｜ swap `Discharge disabled`
- **id**：rent `Pengosongan dilarang` ｜ swap `Discharge dinonaktifkan`
- **th**：rent `ห้ามการปล่อยประจุ` ｜ swap `ปิดใช้งานการคายประจุแล้ว`
- 裁决：rent

### 18. 常用功能
- 键：rent `merchant.profile.commonFunctions` ｜ swap `merchant.home.commonActions`
- **en**：rent `Common Functions` ｜ swap `Common Features`
- **th**：rent `ฟังกชันทั่วไป` ｜ swap `ฟังก์ชันที่ใช้บ่อย`
- 裁决：swap

### 19. 当前已绑定：{value}
- 键：rent `user.profile.currentBound` ｜ swap `user.profile.currentBound`
- **th**：rent `ผูกอยู่ปัจจุบัน: {value}` ｜ swap `ผูกอยู่ในปัจจุบัน: {value}`
- 裁决：rent

### 20. 您还未登录，点我快速登录
- 键：rent `user.common.notLoggedInTap` ｜ swap `user.home.notLoginTips`
- **en**：rent `You are not logged in. Tap to log in` ｜ swap `You are not signed in. Tap to sign in quickly`
- **id**：rent `Anda belum masuk. Ketuk untuk masuk` ｜ swap `Anda belum masuk. Ketuk untuk masuk cepat`
- **th**：rent `คุณยังไม่ได้เข้าสู่ระบบ แตะเพื่อเข้าสู่ระบบ` ｜ swap `คุณยังไม่ได้เข้าสู่ระบบ แตะเพื่อเข้าสู่ระบบอย่างรวดเร็ว`
- 裁决：rent

### 21. 手机号验证
- 键：rent `user.profile.phoneVerify` ｜ swap `user.pwd.phoneVerify`
- **th**：rent `ยืนยันเบอร์โทรศัพท์` ｜ swap `ยืนยันหมายเลขโทรศัพท์`
- 裁决：rent

### 22. 换电柜
- 键：rent `merchant.battery.cabinet` ｜ swap `merchant.tab.cabinet`
- **en**：rent `Swap Cabinet` ｜ swap `Cabinet`
- **id**：rent `Kabinet Tukar Baterai` ｜ swap `Kabinet`
- **th**：rent `ตู้สลับแบตเตอรี่` ｜ swap `ตู้สลับ`
- 裁决：rent

### 23. 操作时间
- 键：rent `merchant.profile.operateTime` ｜ swap `merchant.record.time`
- **en**：rent `Operation Time` ｜ swap `Time`
- **id**：rent `Waktu Operasi` ｜ swap `Waktu`
- **th**：rent `เวลาดำเนินการ` ｜ swap `เวลา`
- 裁决：rent

### 24. 新增成功
- 键：rent `merchant.vehicles.addSuccess` ｜ swap `demoOps.addSuccess`
- **en**：rent `Added successfully` ｜ swap `Added Successfully`
- **id**：rent `Berhasil ditambahkan` ｜ swap `Berhasil Ditambahkan`
- 裁决：rent

### 25. 暂无告警
- 键：rent `merchant.home.noAlerts` ｜ swap `merchant.dashboard.noAlarm`
- **en**：rent `No Alerts` ｜ swap `No alarms`
- **id**：rent `Tidak ada peringatan` ｜ swap `Belum ada alarm`
- **th**：rent `ไม่มีการแจ้งเตือน` ｜ swap `ยังไม่มีการแจ้งเตือน`
- 裁决：rent

### 26. 暂无套餐
- 键：rent `merchant.profile.noPackage` ｜ swap `user.package.empty`
- **en**：rent `No Packages` ｜ swap `No packages`
- **id**：rent `Tidak ada paket` ｜ swap `Belum ada paket`
- **th**：rent `ไม่มีแพ็กเกจ` ｜ swap `ยังไม่มีแพ็กเกจ`
- 裁决：rent

### 27. 暂无定位 · 点击查看
- 键：rent `merchant.vehicles.noLocationTap` ｜ swap `merchant.battery.noLocation`
- **id**：rent `Belum ada lokasi · Ketuk untuk lihat` ｜ swap `Belum ada lokasi · Ketuk untuk melihat`
- 裁决：rent

### 28. 暂无电池
- 键：rent `merchant.vehicles.batteryNoData` ｜ swap `user.battery.empty`
- **en**：rent `No Batteries` ｜ swap `No battery`
- **id**：rent `Tidak ada baterai` ｜ swap `Belum ada baterai`
- **th**：rent `ไม่มีแบตเตอรี่` ｜ swap `ยังไม่มีแบตเตอรี่`
- 裁决：rent

### 29. 暂无记录
- 键：rent `merchant.alert.noHistory` ｜ swap `label.noRecord`
- **id**：rent `Belum ada catatan` ｜ swap `Belum ada riwayat`
- **th**：rent `ไม่มีบันทึก` ｜ swap `ยังไม่มีประวัติ`
- 裁决：rent

### 30. 暂无门店
- 键：rent `user.store.empty` ｜ swap `merchant.store.empty`
- **en**：rent `No Stores` ｜ swap `No stores`
- **id**：rent `Tidak ada toko` ｜ swap `Belum ada toko`
- **th**：rent `ไม่มีร้านค้า` ｜ swap `ยังไม่มีร้านค้า`
- 裁决：rent

### 31. 更多操作
- 键：rent `merchant.common.moreOps` ｜ swap `action.more`
- **id**：rent `Aksi Lainnya` ｜ swap `Tindakan Lainnya`
- **th**：rent `การดำเนินการเพิ่มเติม` ｜ swap `การทำงานเพิ่มเติม`
- 裁决：rent

### 32. 未上传
- 键：rent `user.idInfo.notUploaded` ｜ swap `action.notUploaded`
- **th**：rent `ยังไม่ได้อัปโหลด` ｜ swap `ยังไม่อัปโหลด`
- 裁决：rent

### 33. 未找到匹配地区
- 键：rent `user.home.noMatchRegion` ｜ swap `user.dialcode.noMatch`
- **en**：rent `No matching region found` ｜ swap `No matching region`
- **id**：rent `Wilayah yang cocok tidak ditemukan` ｜ swap `Wilayah tidak ditemukan`
- 裁决：rent

### 34. 未登录
- 键：rent `merchant.profile.notLoggedIn` ｜ swap `demoOps.notLoggedIn`
- **en**：rent `Not Logged In` ｜ swap `Not signed in`
- **id**：rent `Belum Masuk` ｜ swap `Belum masuk`
- 裁决：rent

### 35. 点击空白处关闭
- 键：rent `user.common.clickBlankClose` ｜ swap `action.tapToClose`
- **en**：rent `Tap blank area to close` ｜ swap `Tap anywhere to close`
- 裁决：rent

### 36. 确认绑定
- 键：rent `merchant.common.confirmBind` ｜ swap `merchant.station.confirmBind`
- **en**：rent `Confirm Bind` ｜ swap `Confirm Binding`
- **id**：rent `Konfirmasi Hubungkan` ｜ swap `Konfirmasi Ikat`
- 裁决：rent

### 37. 禁止后设备将无法放电
- 键：rent `merchant.battery.dischargeForbid` ｜ swap `merchant.battery.dischargeForbid`
- **en**：rent `After disabling, the device will not be able to discharge` ｜ swap `The device cannot discharge after disabling`
- **id**：rent `Setelah dilarang, perangkat tidak dapat melepas muatan` ｜ swap `Perangkat tidak dapat melakukan discharge setelah dinonaktifkan`
- **th**：rent `หลังจากปิดใช้งาน อุปกรณ์จะไม่สามารถปล่อยประจุได้` ｜ swap `อุปกรณ์จะไม่สามารถคายประจุได้หลังปิดใช้งาน`
- 裁决：rent

### 38. 禁用
- 键：rent `merchant.status.disabled` ｜ swap `merchant.cabinet.disable`
- **en**：rent `Disabled` ｜ swap `Disable`
- **id**：rent `Nonaktif` ｜ swap `Nonaktifkan`
- 裁决：rent

### 39. 租用中
- 键：rent `merchant.vehicles.statusRented` ｜ swap `merchant.dashboard.renting`
- **id**：rent `Disewa` ｜ swap `Sedang Disewa`
- **th**：rent `เช่าแล้ว` ｜ swap `กำลังเช่า`
- 裁决：rent

### 40. 稍后提醒
- 键：rent `merchant.version.later` ｜ swap `user.version.later`
- **en**：rent `Remind Later` ｜ swap `Remind Me Later`
- 裁决：swap

### 41. 立即支付
- 键：rent `user.orders.payNow` ｜ swap `action.payNow`
- **th**：rent `ชำระเลย` ｜ swap `ชำระเงินเลย`
- 裁决：rent

### 42. 请上传清晰证件照，避免反光（最多2张）
- 键：rent `user.idInfo.photoHint` ｜ swap `user.id.photoTip`
- **en**：rent `Please upload clear document photos, avoid glare (up to 2)` ｜ swap `Please upload clear ID photos without glare (max 2)`
- **id**：rent `Unggah foto dokumen yang jelas, hindari pantulan (maksimal 2)` ｜ swap `Unggah foto identitas yang jelas tanpa pantulan (maks 2)`
- **th**：rent `กรุณาอัปโหลดรูปเอกสารให้ชัดเจน หลีกเลี่ยงแสงสะท้อน (สูงสุด 2 รูป)` ｜ swap `กรุณาอัปโหลดรูปบัตรที่ชัดเจน ไม่มีแสงสะท้อน (สูงสุด 2 รูป)`
- 裁决：rent

### 43. 请再次输入新密码
- 键：rent `user.profile.confirmNewPwdPlaceholder` ｜ swap `user.pwd.confirmPlaceholder`
- **id**：rent `Masukkan kembali kata sandi baru` ｜ swap `Masukkan ulang kata sandi baru`
- 裁决：rent

### 44. 请输入 6–64 位新密码
- 键：rent `user.profile.newPwdPlaceholder` ｜ swap `user.pwd.newPlaceholder`
- **en**：rent `Please enter a new password (6-64 characters)` ｜ swap `Please enter a new password of 6-64 characters`
- **id**：rent `Masukkan kata sandi baru (6-64 karakter)` ｜ swap `Masukkan kata sandi baru 6-64 karakter`
- **th**：rent `กรุณากรอกรหัสผ่านใหม่ (6-64 ตัวอักษร)` ｜ swap `กรุณากรอกรหัสผ่านใหม่ 6-64 ตัวอักษร`
- 裁决：rent

### 45. 请输入证件号码
- 键：rent `user.idInfo.idNoPlaceholder` ｜ swap `user.id.cardNoPlaceholder`
- **en**：rent `Please enter the ID number` ｜ swap `Please enter ID number`
- **id**：rent `Masukkan nomor dokumen` ｜ swap `Masukkan nomor identitas`
- **th**：rent `กรุณากรอกหมายเลขบัตรประชาชน` ｜ swap `กรุณากรอกหมายเลขบัตร`
- 裁决：rent

### 46. 请输入邮箱地址
- 键：rent `user.profile.emailAddressPlaceholder` ｜ swap `placeholder.email`
- **en**：rent `Please enter your email address` ｜ swap `Please enter email address`
- **th**：rent `กรุณากรอกที่อยู่อีเมลของคุณ` ｜ swap `กรุณากรอกอีเมล`
- **zh-HK**：rent `請輸入郵箱地址` ｜ swap `請輸入電郵地址`
- 裁决：rent

### 47. 请输入邮箱验证码
- 键：rent `user.login.emailCodePlaceholder` ｜ swap `placeholder.emailCode`
- **en**：rent `Please enter the email verification code` ｜ swap `Please enter email verification code`
- **th**：rent `กรุณากรอกรหัสยืนยันอีเมล` ｜ swap `กรุณากรอกรหัสยืนยันทางอีเมล`
- **zh-HK**：rent `請輸入郵箱驗證碼` ｜ swap `請輸入電郵驗證碼`
- 裁决：rent

### 48. 身份证照片
- 键：rent `user.idInfo.idPhoto` ｜ swap `user.id.photo`
- **en**：rent `ID Photo` ｜ swap `ID Card Photo`
- **th**：rent `รูปบัตรประชาชน` ｜ swap `รูปบัตรประจำตัวประชาชน`
- 裁决：rent

### 49. 轨迹
- 键：rent `user.vehicles.track` ｜ swap `user.battery.track`
- **en**：rent `Vehicle Track` ｜ swap `Track`
- **id**：rent `Lintasan Kendaraan` ｜ swap `Jejak`
- **th**：rent `เส้นทางยานพาหนะ` ｜ swap `เส้นทาง`
- **zh-HK**：rent `車輛軌跡` ｜ swap `軌跡`
- 裁决：swap

### 50. 运营状态
- 键：rent `merchant.vehicles.operatingStatus` ｜ swap `merchant.cabinet.bizStatus`
- **en**：rent `Operating Status` ｜ swap `Operation Status`
- **id**：rent `Status Operasi` ｜ swap `Status Operasional`
- **th**：rent `สถานะการทำงาน` ｜ swap `สถานะการดำเนินงาน`
- 裁决：rent

### 51. 重新定位
- 键：rent `user.home.relocate` ｜ swap `action.relocate`
- **en**：rent `Re-locate` ｜ swap `Relocate`
- **id**：rent `Atur Ulang Lokasi` ｜ swap `Lokasi Ulang`
- 裁决：swap

### 52. 门店信息
- 键：rent `user.orders.storeInfo` ｜ swap `merchant.store.formTitle`
- **en**：rent `Store Info` ｜ swap `Store Information`
- **id**：rent `Info Toko` ｜ swap `Informasi Toko`
- 裁决：swap

