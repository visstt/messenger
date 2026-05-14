package storage

import (
	"context"
	"fmt"
	"io"
	"mime"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"

	"messenger/backend/internal/config"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type Uploader interface {
	Upload(ctx context.Context, key string, reader io.Reader, contentType string) (string, error)
}

type Downloader interface {
	Download(ctx context.Context, key string, byteRange string) (Object, error)
}

type Object struct {
	Body          io.ReadCloser
	ContentType   string
	ContentLength *int64
	ContentRange  string
	AcceptRanges  string
}

func NewUploader(ctx context.Context, cfg config.Config) (Uploader, error) {
	if cfg.S3Endpoint == "" || cfg.S3BucketName == "" || cfg.S3AccessKey == "" || cfg.S3SecretKey == "" {
		return LocalUploader{Dir: cfg.UploadDir}, nil
	}

	awsCfg, err := awsconfig.LoadDefaultConfig(
		ctx,
		awsconfig.WithRegion(cfg.S3Region),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			cfg.S3AccessKey,
			cfg.S3SecretKey,
			"",
		)),
	)
	if err != nil {
		return nil, fmt.Errorf("load s3 config: %w", err)
	}
	awsCfg.RequestChecksumCalculation = aws.RequestChecksumCalculationWhenRequired

	client := s3.NewFromConfig(awsCfg, func(options *s3.Options) {
		options.BaseEndpoint = aws.String(cfg.S3Endpoint)
		options.UsePathStyle = true
	})

	return S3Uploader{
		Client:    client,
		Bucket:    cfg.S3BucketName,
		Endpoint:  strings.TrimRight(cfg.S3Endpoint, "/"),
		PublicURL: strings.TrimRight(cfg.S3PublicURL, "/"),
	}, nil
}

type LocalUploader struct {
	Dir string
}

func (u LocalUploader) Upload(ctx context.Context, key string, reader io.Reader, _ string) (string, error) {
	if err := os.MkdirAll(u.Dir, 0o755); err != nil {
		return "", err
	}

	filename := path.Base(key)
	targetPath := filepath.Join(u.Dir, filename)
	dst, err := os.Create(targetPath)
	if err != nil {
		return "", err
	}
	defer dst.Close()

	if _, err := io.Copy(dst, reader); err != nil {
		return "", err
	}

	return "/uploads/" + filename, nil
}

type S3Uploader struct {
	Client    *s3.Client
	Bucket    string
	Endpoint  string
	PublicURL string
}

func (u S3Uploader) Upload(ctx context.Context, key string, reader io.Reader, contentType string) (string, error) {
	input := &s3.PutObjectInput{
		Bucket: aws.String(u.Bucket),
		Key:    aws.String(key),
		Body:   reader,
	}
	if contentType != "" {
		input.ContentType = aws.String(contentType)
	}

	if _, err := u.Client.PutObject(ctx, input); err != nil {
		return "", err
	}

	return u.publicObjectURL(key), nil
}

func (u S3Uploader) Download(ctx context.Context, key string, byteRange string) (Object, error) {
	input := &s3.GetObjectInput{
		Bucket: aws.String(u.Bucket),
		Key:    aws.String(key),
	}
	if byteRange != "" {
		input.Range = aws.String(byteRange)
	}

	output, err := u.Client.GetObject(ctx, input)
	if err != nil {
		return Object{}, err
	}

	return Object{
		Body:          output.Body,
		ContentType:   aws.ToString(output.ContentType),
		ContentLength: output.ContentLength,
		ContentRange:  aws.ToString(output.ContentRange),
		AcceptRanges:  aws.ToString(output.AcceptRanges),
	}, nil
}

func (u S3Uploader) publicObjectURL(key string) string {
	escapedKey := escapeKey(key)
	if u.PublicURL != "" {
		return u.PublicURL + "/" + escapedKey
	}
	return "/uploads/" + escapedKey
}

func ContentType(filename string, fallback string) string {
	if fallback != "" {
		return fallback
	}
	if detected := mime.TypeByExtension(filepath.Ext(filename)); detected != "" {
		return detected
	}
	return "application/octet-stream"
}

func escapeKey(key string) string {
	parts := strings.Split(key, "/")
	for index, part := range parts {
		parts[index] = url.PathEscape(part)
	}
	return strings.Join(parts, "/")
}
