import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    this.initTransporter();
  }

  private initTransporter() {
    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<number>('SMTP_PORT', 587);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const secure = this.config.get<string>('SMTP_SECURE', 'true') === 'true';

    if (!host || !user || !pass) {
      this.logger.warn('SMTP 配置不完整，邮件发送功能将不可用');
      return;
    }

    this.logger.log(`正在初始化 SMTP: ${host}:${port}, secure=${secure}`);

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure, // true for 465, false for other ports
      auth: { user, pass },
      tls: {
        // 对于某些企业邮箱可能需要
        rejectUnauthorized: true,
      },
      connectionTimeout: 10000, // 10秒连接超时
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    this.transporter.verify((error) => {
      if (error) {
        this.logger.error('SMTP 连接验证失败:', error);
      } else {
        this.logger.log('SMTP 连接验证成功');
      }
    });
  }

  async sendVerificationCode(to: string, code: string, type: 'register' | 'reset'): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn('SMTP 未配置，无法发送邮件');
      return false;
    }

    const fromName = this.config.get<string>('SMTP_FROM_NAME', '终末地抽卡助手');
    const fromEmail = this.config.get<string>('SMTP_USER');

    const subject = type === 'register' ? '注册验证码 - 终末地抽卡助手' : '重置密码验证码 - 终末地抽卡助手';
    const actionText = type === 'register' ? '注册账号' : '重置密码';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a1a; color: #e0e0e0; padding: 40px 20px; margin: 0; }
          .container { max-width: 480px; margin: 0 auto; background: #252525; border-radius: 16px; padding: 40px; border: 1px solid #333; }
          .logo { text-align: center; margin-bottom: 24px; }
          .logo-text { color: #fffa00; font-size: 24px; font-weight: bold; }
          h1 { color: #fff; font-size: 20px; margin-bottom: 16px; text-align: center; }
          .code-box { background: #1a1a1a; border: 2px solid #fffa00; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
          .code { font-size: 32px; font-weight: bold; color: #fffa00; letter-spacing: 8px; font-family: monospace; }
          .tip { color: #888; font-size: 14px; text-align: center; margin-top: 24px; }
          .footer { text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #333; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <span class="logo-text">终末地抽卡助手</span>
          </div>
          <h1>您正在${actionText}</h1>
          <p style="color: #aaa; text-align: center;">请使用以下验证码完成验证：</p>
          <div class="code-box">
            <span class="code">${code}</span>
          </div>
          <p class="tip">验证码有效期为 10 分钟，请勿将验证码告知他人。</p>
          <p class="tip">如果这不是您本人的操作，请忽略此邮件。</p>
          <div class="footer">
            此邮件由系统自动发送，请勿回复。
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        html,
      });
      this.logger.log(`验证码邮件已发送至 ${to}`);
      return true;
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`发送邮件失败: ${msg}`);
      return false;
    }
  }
}
