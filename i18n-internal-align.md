# rent ↔ swap 目录内部对齐清单（阶段 1 · 先内部归一）

生成日期：2026-09-29　｜　来源：`locales/rent/zh-CN.json` × `locales/swap/zh-CN.json` 各自**目录内**按中文值分组（`demo.*` 已排除）

依据：`AGENTS.md` §5「同一目录内同样不得出现『一句中文两个译法』」。

处理顺序：**先本清单（阶段 1 · 内部归一）→ 再 `i18n-cross-drift.md`（阶段 2 · 跨目录对齐）**。内部归一后，跨目录才有唯一基准可二选一。

- rent 内部译法不一致 **21** 组；swap 内部 **35** 组
- 每条末尾留 `裁决：` 行，填该组统一的译法（或 `键:值` 指定保留某键值）；同一目录内该中文的所有键将同步为该译法
- 裁决顺序（AGENTS.md §5）：① `common.*` 已登记 → ② 术语基线 → ③ 权威侧
- 已决：货币组统一走简称 `CNY` / `HKD` / `IDR`（§5 货币术语基线），已从本清单消除
- 只列**有差异的语言**；`<缺>` 表示该语言缺该键（属硬错误，由 `scripts/i18n_check.mjs` 的 MISSING 报告）

## 一、rent 目录内部（21 组）

### R1. 充值金额
- 键：`user.wallet.topupAmount`、`merchant.wallet.rechargeAmount`
- **id**：`Jumlah Isi Ulang` ｜ `Jumlah Top Up`
- 裁决：Jumlah Top Up

### R2. 创建时间
- 键：`common.orders.createdTime`、`common.createTime`
- **en**：`Created Time` ｜ `Created At`
- 裁决：Created Time

### R3. 可上传身份证、驾驶证、合同等
- 键：`user.orders.uploadDocsHint`、`merchant.profile.docTypesHint`
- **en**：`You can upload ID, driver's license, contract, etc.` ｜ `ID card, driver's license, contract, etc.`
- **id**：`Anda dapat mengunggah KTP, SIM, kontrak, dll.` ｜ `KTP, SIM, kontrak, dan lainnya`
- **th**：`คุณสามารถอัปโหลดบัตรประชาชน ใบอนุญาตขับขี่ สัญญา ฯลฯ` ｜ `บัตรประชาชน ใบอนุญาตขับขี่ สัญญา ฯลฯ`
- **zh-HK**：`可上傳身份證、駕照、合約等` ｜ `可上傳身份證、駕照、合同等`
- 裁决：You can upload ID, driver's license, contract, etc.（选 user.orders.uploadDocsHint；完整提示句更友好，zh-HK 取「合約」）

### R4. 实名信息
- 键：`user.idInfo.realName`、`merchant.profile.idInfo`
- **en**：`Real-Name Info` ｜ `KYC`
- **id**：`Info Verifikasi` ｜ `KYC`
- **th**：`ข้อมูลยืนยันตัวตน` ｜ `KYC`
- 裁决：en/id/th: KYC；中文除外（zh-CN 实名信息 / zh-HK 實名資訊）（选 merchant.profile.idInfo；国际专名保留）

### R5. 手动续租
- 键：`user.orders.manualRenew`、`merchant.renewal.manual`
- **en**：`Manual renew` ｜ `Manual Renewal`
- **id**：`Perpanjang Manual` ｜ `Perpanjangan Manual`
- 裁决：Perpanjang Manual

### R6. 扣减
- 键：`user.walletType.deduct`、`merchant.wallet.deduct`
- **en**：`Deduction` ｜ `Deduct`
- **id**：`Pengurangan` ｜ `Potong`
- **th**：`การหัก` ｜ `หัก`
- 裁决：Deduct

### R7. 暂无订单
- 键：`user.orders.noResults`、`merchant.wallet.noRechargeOrder`
- **en**：`No Orders` ｜ `No orders yet`
- **id**：`Tidak ada pesanan` ｜ `Belum ada pesanan`
- **th**：`ไม่มีคำสั่งซื้อ` ｜ `ยังไม่มีคำสั่งซื้อ`
- 裁决：No Orders（选 user.orders.noResults；空态 Title Case 简洁式）

### R8. 最近告警
- 键：`merchant.home.recentAlerts`、`merchant.home.alert.recent`
- **en**：`Recent Alerts` ｜ `Recent alerts`
- **id**：`Peringatan Terkini` ｜ `Peringatan terbaru`
- 裁决：Recent Alerts（选 merchant.home.recentAlerts；Title Case）

### R9. 月租×{n}月
- 键：`common.label.rentMonthly`、`merchant.orders.planMonthlyMonths`
- **en**：`Monthly × {n} mo` ｜ `Rental × {n} Months`
- **id**：`Sewa per bulan × {n} bulan` ｜ `Sewa Bulanan × {n} Bulan`
- **th**：`เช่ารายเดือน × {n} เดือน` ｜ `เช่า × {n} เดือน`
- 裁决：Monthly × {n} mo（选 common.label.rentMonthly）

### R10. 有效期至 {date}
- 键：`common.label.validUntil`、`user.vehicles.validUntil`
- **th**：`ใช้ได้ถึง {date}` ｜ `ใช้งานได้ถึง {date}`
- 裁决：ใช้ได้ถึง {date}（选 common.label.validUntil）

### R11. 电量
- 键：`merchant.vehicles.batteryPower`、`merchant.vehicles.batteryLevel`
- **en**：`Power Level` ｜ `Battery Level`
- **id**：`Level Daya` ｜ `Level Baterai`
- **th**：`ระดับพลังงาน` ｜ `ระดับแบตเตอรี่`
- 裁决：Battery Level（选 merchant.vehicles.batteryLevel；"电量"用 Battery Level 更明确）

### R12. 确认替换
- 键：`user.profile.confirmReplace`、`merchant.profile.confirmReplaceBind`
- **en**：`Confirm Change` ｜ `Confirm replacement`
- **id**：`Konfirmasi Ganti` ｜ `Konfirmasi penggantian`
- **th**：`ยืนยันการเปลี่ยน` ｜ `ยืนยันการแทนที่`
- 裁决：Confirm Change（选 user.profile.confirmReplace；Title Case）

### R13. 绑定电池
- 键：`user.vehicles.bindBattery`、`merchant.battery.bind`
- **en**：`Bind Battery` ｜ `Bind battery`
- **id**：`Ikat Baterai` ｜ `Ikat baterai`
- 裁决：Bind Battery（选 user.vehicles.bindBattery；Title Case）

### R14. 绑定车辆
- 键：`user.vehicles.bindVehicle`、`merchant.orders.opAssignVehicle`
- **en**：`Bind Vehicle` ｜ `Bind vehicle`
- **id**：`Ikat Kendaraan` ｜ `Ikat kendaraan`
- 裁决：Bind Vehicle（选 user.vehicles.bindVehicle；Title Case）

### R15. 自动续租
- 键：`user.orders.autoRenew`、`merchant.renewal.auto`
- **en**：`Auto-renew` ｜ `Auto Renewal`
- **id**：`Perpanjang Otomatis` ｜ `Perpanjangan Otomatis`
- 裁决：Auto Renewal（选 merchant.renewal.auto；名词短语）

### R16. 订单编号
- 键：`common.orders.orderId`、`common.label.orderNo`
- **en**：`Order Number` ｜ `Order No.`
- **id**：`Nomor Pesanan` ｜ `No. Pesanan`
- 裁决：Order Number（选 common.orders.orderId；字段标签用完整式，优于 Order No.）

### R17. 订单退款
- 键：`user.walletType.orderRefund`、`merchant.orders.opRefund`
- **en**：`Order Refund` ｜ `Order refund`
- **id**：`Pengembalian Pesanan` ｜ `Pengembalian dana pesanan`
- 裁决：Order Refund（选 user.walletType.orderRefund；Title Case）

### R18. 请输入充值金额
- 键：`user.wallet.topupAmountPlaceholder`、`merchant.wallet.rechargeAmountPlaceholder`
- **en**：`Please enter the top-up amount` ｜ `Please enter top-up amount`
- **id**：`Masukkan jumlah isi ulang` ｜ `Masukkan jumlah top up`
- 裁决：en: Please enter top-up amount / id: Masukkan jumlah top up（占位符去 the；id 与 R1 统一 Top Up）

### R19. 请输入姓名
- 键：`user.idInfo.namePlaceholder`、`merchant.profile.nameError`
- **en**：`Please enter your name` ｜ `Please enter name`
- **th**：`กรุณากรอกชื่อของคุณ` ｜ `กรุณากรอกชื่อ`
- 裁决：Please enter your name（选 user.idInfo.namePlaceholder）

### R20. 请输入电池编号
- 键：`user.orders.inputBattNo`、`merchant.vehicles.battInputPlaceholder`
- **en**：`Enter battery number` ｜ `Please enter battery number`
- 裁决：Please enter battery number（选 merchant.vehicles.battInputPlaceholder；占位符完整式）

### R21. 车架号
- 键：`user.vehicles.frameNo`、`merchant.alert.vin`
- **en**：`Frame No.` ｜ `VIN`
- **id**：`Nomor Rangka` ｜ `Nomor rangka`
- 裁决：en/id/th: VIN；中文除外（zh-CN 车架号 / zh-HK 車架號）（选 merchant.alert.vin；国际专名保留）

## 二、swap 目录内部（35 组）

### S1. 下一步
- 键：`action.next`、`common.profile.nextStep`
- **id**：`Selanjutnya` ｜ `Lanjut`
- 裁决：Lanjut（选 common.profile.nextStep；印尼语按钮优先短式）

### S2. 个人信息
- 键：`user.profile.title`、`common.profile.personalInfo`
- **en**：`Profile` ｜ `Personal Information`
- **id**：`Informasi Pribadi` ｜ `Info Pribadi`
- **th**：`ข้อมูลส่วนตัว` ｜ `ข้อมูลส่วนบุคคล`
- 裁决：Personal Information（选 common.profile.personalInfo）

### S3. 充电系统
- 键：`user.settings.systemCharge`、`common.systemSwitch.charge`
- **id**：`Sistem Pengisian` ｜ `Sistem Pengisian Daya`
- 裁决：Sistem Pengisian Daya（选 common.systemSwitch.charge）

### S4. 关闭
- 键：`demoOps.disable`、`common.action.close`
- **en**：`Off` ｜ `Close`
- **id**：`Nonaktifkan` ｜ `Tutup`
- 裁决：Close（选 common.action.close）

### S5. 切换系统
- 键：`user.settings.switchSystem`、`common.systemSwitch.title`
- **id**：`Ganti Sistem` ｜ `Tukar Sistem`
- 裁决：Tukar Sistem（选 common.systemSwitch.title）

### S6. 创建时间
- 键：`user.order.createdTime`、`common.orders.createdTime`、`common.createTime`
- **en**：`Created Time` ｜ `Created At`
- 裁决：Created Time（选 common.orders.createdTime；与 rent R2 一致）

### S7. 历史轨迹
- 键：`user.battery.historyTrack`、`common.vehicles.historyTrack`
- **en**：`Location History` ｜ `History Track`
- **id**：`Riwayat Jejak` ｜ `Lintasan Historis`
- 裁决：`History Track`（选 common.vehicles.historyTrack；非异语境·「历史轨迹」标题两端统一，交换端 user.battery.historyTrack 去掉 Location History）

### S8. 发现新版本
- 键：`user.version.newTitle`、`common.version.newVersion`
- **en**：`New Version Available` ｜ `New Version Found`
- **id**：`Versi Baru Tersedia` ｜ `Versi baru ditemukan`
- 裁决：New Version Found（选 common.version.newVersion）

### S9. 取消时间
- 键：`user.order.cancelTime`、`common.orders.cancelTime`
- **en**：`Canceled Time` ｜ `Cancellation Time`
- **id**：`Waktu Dibatalkan` ｜ `Waktu Pembatalan`
- 裁决：Cancellation Time（选 common.orders.cancelTime）

### S10. 块
- 键：`label.unit.block`、`common.unit.battery`
- **en**：` pcs` ｜ `battery(ies)`
- **id**：` buah` ｜ `unit`
- **th**：` ก้อน` ｜ `ก้อน`
- 裁决：battery(ies)（选 common.unit.battery；单位例外留待跨目录阶段再议）

### S11. 已取消
- 键：`user.order.status.canceled`、`common.orderStatus.cancelled`
- **en**：`Canceled` ｜ `Cancelled`
- 裁决：Cancelled（选 common.orderStatus.cancelled；双 l 英式规范）

### S12. 已是最新版本
- 键：`user.version.latestTitle`、`common.version.latest`
- **en**：`You are on the latest version` ｜ `Already the latest version`
- **id**：`Anda menggunakan versi terbaru` ｜ `Sudah versi terbaru`
- 裁决：Already the latest version（选 common.version.latest）

### S13. 已登录
- 键：`demoOps.loggedIn`、`common.label.loggedIn`
- **en**：`Signed in` ｜ `Logged In`
- **id**：`Sudah masuk` ｜ `Sudah Masuk`
- 裁决：Logged In（选 common.label.loggedIn）

### S14. 待支付
- 键：`user.order.status.unpaid`、`common.orders.payPending`
- **en**：`Unpaid` ｜ `Pending Payment`
- 裁决：Pending Payment（选 common.orders.payPending）

### S15. 必须字母开头，仅支持字母、数字、下划线，长度4～20位
- 键：`user.profile.accountRule`、`common.profile.accountFormatHint`
- **en**：`Must start with a letter; only letters, numbers and underscores; 4-20 characters` ｜ `Must start with a letter; letters, numbers and underscores only; 4–20 characters`
- **id**：`Harus diawali huruf; hanya huruf, angka, dan garis bawah; 4-20 karakter` ｜ `Harus dimulai dengan huruf; hanya huruf, angka, dan garis bawah; 4–20 karakter`
- **th**：`ต้องขึ้นต้นด้วยตัวอักษร ใช้ได้เฉพาะตัวอักษร ตัวเลข และขีดล่าง ความยาว 4-20 ตัวอักษร` ｜ `ต้องขึ้นต้นด้วยตัวอักษร ใช้ได้เฉพาะตัวอักษร ตัวเลข และขีดล่าง ความยาว 4–20 ตัว`
- **zh-HK**：`必須字母開頭，僅支持字母、數字、下劃線，長度4～20位` ｜ `必須字母開頭，僅支持字母、數字、底線，長度4～20位`
- 裁决：选 common.profile.accountFormatHint（长版规范：letters…only / 4–20 连字符）

### S16. 我的
- 键：`user.tab.mine`、`common.tab.profile`
- **en**：`Me` ｜ `Profile`
- **id**：`Saya` ｜ `Profil`
- **th**：`ของฉัน` ｜ `โปรไฟล์`
- 裁决：Profile（选 common.tab.profile）

### S17. 支持输入2-20个字符，不限中文、数字、字母、符号
- 键：`user.profile.nicknameRule`、`common.profile.nicknameHint`
- **en**：`2-20 characters; Chinese, numbers, letters and symbols are all supported` ｜ `Length 2–20; Chinese, letters, numbers and symbols are all allowed`
- **id**：`2-20 karakter; mendukung huruf Mandarin, angka, huruf, dan simbol` ｜ `Panjang 2–20 karakter; huruf, angka, dan simbol diperbolehkan`
- **th**：`รองรับ 2-20 ตัวอักษร ใช้ได้ทั้งอักษรจีน ตัวเลข ตัวอักษร และสัญลักษณ์` ｜ `ความยาว 2–20 ตัวอักษร ภาษา ตัวเลข และสัญลักษณ์ใช้ได้`
- 裁决：选 common.profile.nicknameHint（长版规范：Length 2–20…）

### S18. 有告警
- 键：`merchant.filter.hasAlarm`、`common.label.hasAlert`
- **en**：`Has Alarm` ｜ `Has Alerts`
- **id**：`Ada Alarm` ｜ `Ada Peringatan`
- 裁决：Has Alerts（选 common.label.hasAlert；术语统一 Alert）

### S19. 未绑定
- 键：`user.profile.unbound`、`common.profile.notBound`
- **en**：`Not bound` ｜ `Not Bound`
- **id**：`Belum terikat` ｜ `Belum Terhubung`
- **th**：`ยังไม่ผูก` ｜ `ยังไม่ได้ผูก`
- 裁决：Not Bound（选 common.profile.notBound）

### S20. 步行
- 键：`label.unit.walk`、`common.vehicles.walk`
- **en**：`walk` ｜ `Walk`
- **id**：`jalan kaki` ｜ `Berjalan`
- 裁决：Walk（选 common.vehicles.walk）

### S21. 注销账号
- 键：`user.profile.deleteAccount`、`common.action.deactivateAccount`
- **en**：`Delete Account` ｜ `Deactivate Account`
- **id**：`Hapus Akun` ｜ `Nonaktifkan Akun`
- **th**：`ลบบัญชี` ｜ `ปิดใช้งานบัญชี`
- 裁决：Deactivate Account（选 common.action.deactivateAccount；为项目既定术语）

### S22. 确定
- 键：`action.ok`、`common.orders.filterConfirm`
- **en**：`OK` ｜ `Confirm`
- **id**：`OK` ｜ `Konfirmasi`
- **th**：`ตกลง` ｜ `ยืนยัน`
- 裁决：Confirm（选 common.orders.filterConfirm；比 OK 更明确）

### S23. 确定取消该订单？取消后不可恢复
- 键：`user.order.cancelConfirmDesc`、`common.orders.confirmCancelDesc`
- **en**：`Cancel this order? This cannot be undone.` ｜ `Are you sure you want to cancel this order? This cannot be undone.`
- **id**：`Batalkan pesanan ini? Tindakan ini tidak dapat dibatalkan.` ｜ `Yakin batalkan pesanan ini? Tindakan ini tidak dapat dibatalkan.`
- **th**：`ยกเลิกคำสั่งซื้อนี้หรือไม่? เมื่อยกเลิกแล้วจะไม่สามารถกู้คืนได้` ｜ `คุณแน่ใจหรือไม่ที่จะยกเลิกคำสั่งซื้อนี้? การกระทำนี้ไม่สามารถย้อนกลับได้`
- 裁决：选 common.orders.confirmCancelDesc（全版：Are you sure…This cannot be undone.）

### S24. 禁用机柜
- 键：`merchant.cabinet.disableTitle`、`merchant.useRecord.action.disableCabinet`
- **en**：`Disable Cabinet` ｜ `Disabled cabinet`
- **id**：`Nonaktifkan Kabinet` ｜ `Menonaktifkan kabinet`
- 裁决：Disable Cabinet（选 merchant.cabinet.disableTitle；动作 Title Case）

### S25. 绑定
- 键：`action.bind`、`common.action.bind`
- **id**：`Ikat` ｜ `Hubungkan`
- 裁决：Hubungkan（选 common.action.bind）

### S26. 绑定手机号
- 键：`user.bindPhone.title`、`common.profile.bindPhone`
- **en**：`Bind Phone Number` ｜ `Bind Phone`
- **id**：`Ikat Nomor Ponsel` ｜ `Hubungkan Ponsel`
- **th**：`ผูกหมายเลขโทรศัพท์` ｜ `ผูกเบอร์โทรศัพท์`
- 裁决：Bind Phone（选 common.profile.bindPhone；简洁式）

### S27. 绑定邮箱
- 键：`user.bindEmail.title`、`common.profile.bindEmail`
- **id**：`Ikat Email` ｜ `Hubungkan Email`
- 裁决：Hubungkan Email（选 common.profile.bindEmail）

### S28. 编辑
- 键：`action.edit`、`common.action.edit`
- **id**：`Ubah` ｜ `Sunting`
- 裁决：Sunting（选 common.action.edit；与 rent 一致）

### S29. 订单编号
- 键：`label.orderNo`、`common.orders.orderId`、`common.label.orderNo`
- **en**：`Order No.` ｜ `Order Number`
- **id**：`Nomor Pesanan` ｜ `No. Pesanan`
- 裁决：Order Number（选 common.orders.orderId；与 R16/R29 口径一致）

### S30. 请输入昵称
- 键：`user.profile.nicknamePlaceholder`、`common.profile.nicknamePlaceholder`
- **en**：`Please enter nickname` ｜ `Enter a nickname`
- **th**：`กรุณากรอกชื่อเล่น` ｜ `กรอกชื่อเล่น`
- 裁决：Enter a nickname（选 common.profile.nicknamePlaceholder；现代占位符式）

### S31. 起
- 键：`user.records.origin`、`common.vehicles.trackStartPin`
- **id**：`Awal` ｜ `Mulai`
- **th**：`เริ่ม` ｜ `เริ่มต้น`
- 裁决：Mulai（选 common.vehicles.trackStartPin）

### S32. 距您
- 键：`user.station.distancePrefix`、`common.vehicles.distanceFromYou`
- **en**：`From you ` ｜ `From you`
- **id**：`Dari Anda ` ｜ `Jarak dari Anda`
- **th**：`ห่างจากคุณ ` ｜ `ห่างจากคุณ`
- 裁决：From you（选 common.vehicles.distanceFromYou；去掉尾随空格）

### S33. 进入系统
- 键：`user.settings.enterSystem`、`common.systemSwitch.enter`
- **en**：`Enter System` ｜ `Enter`
- **id**：`Masuk Sistem` ｜ `Masuk`
- 裁决：Enter（选 common.systemSwitch.enter；按钮短式）

### S34. 邮箱验证
- 键：`user.pwd.emailVerify`、`common.profile.verifyByEmail`
- **th**：`ยืนยันทางอีเมล` ｜ `ยืนยันอีเมล`
- 裁决：ยืนยันอีเมล（选 common.profile.verifyByEmail）

### S35. 重置
- 键：`action.reset`、`common.reset`
- **id**：`Reset` ｜ `Atur Ulang`
- 裁决：Atur Ulang（选 common.reset；印尼语标准词）

